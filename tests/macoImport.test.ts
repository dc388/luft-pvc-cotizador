import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getTableColumns } from "drizzle-orm";
import { after, test } from "node:test";
import {
  supplierCatalogSources,
  supplierHardwareDocs,
  supplierHardwareItems,
  supplierHardwareMappings,
  supplierHardwarePrices,
} from "@/db/schema";
import { BRAND, CURRENCY, SHEET_PRECIO, SUPPLIER, TERMS, parsePriceList } from "@/lib/maco/priceList";
import { openWorkbook } from "@/scripts/lib/xlsx";
import {
  DOC_COLUMNS,
  ITEM_COLUMNS,
  PRICE_COLUMNS,
  SOURCE_COLUMNS,
  itemId,
  writeManuals,
  writePriceList,
  type SourceInput,
} from "@/scripts/lib/macoWriter";
import { inTransaction } from "@/scripts/lib/localD1";
import { scanManuals } from "@/scripts/lib/manuals";
import { DEFAULT_HEADER_ROWS, ORDEN_SENTINEL, SAMPLE_ROWS, buildWorkbook } from "./fixtures/macoWorkbook";

const workspace = mkdtempSync(join(tmpdir(), "maco-import-"));

/** SQL de la migración 0005, aplicada tal cual a una base temporal. */
const MIGRATION = readFileSync("drizzle/0005_busy_triathlon.sql", "utf8");

// Windows no borra un archivo con un descriptor abierto, así que toda base que se abre se
// registra y se cierra al final: si no, la limpieza falla con EPERM y ensucia la corrida.
const opened: DatabaseSync[] = [];
after(() => {
  for (const db of opened) {
    try {
      db.close();
    } catch {
      // Ya estaba cerrada; no hay nada que hacer.
    }
  }
  rmSync(workspace, { recursive: true, force: true, maxRetries: 3 });
});

let counter = 0;
function freshDb(): DatabaseSync {
  const db = new DatabaseSync(join(workspace, `db-${counter++}.sqlite`));
  opened.push(db);
  for (const statement of MIGRATION.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) db.exec(trimmed);
  }
  return db;
}

/** `node:sqlite` devuelve filas sin prototipo, que `deepEqual` considera distintas de `{}`. */
function plain<T>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row }));
}

function fixtureSource(overrides: Partial<SourceInput> = {}): SourceInput {
  return {
    sourceType: "lista-precios",
    supplier: SUPPLIER,
    brand: BRAND,
    fileName: "LOUDVENTURES_MEXpricelist22_2022_MACO.xlsx",
    fileHash: "a".repeat(64),
    fileSize: 87357,
    fileModifiedAt: "2022-05-01T00:00:00.000Z",
    revision: "ABR_22",
    effectiveDate: "2022-05-01",
    currency: CURRENCY,
    terms: TERMS,
    active: 0,
    historical: 1,
    ...overrides,
  };
}

function sampleItems() {
  const path = join(workspace, `libro-${counter++}.xlsx`);
  writeFileSync(path, buildWorkbook({ precio: [...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS] }));
  return parsePriceList(openWorkbook(path).readSheetByName(SHEET_PRECIO)).items;
}

function count(db: DatabaseSync, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
}

// ---------------------------------------------------------------------------------------------
// Guardia de deriva: el importador escribe SQL a mano, así que las columnas tienen que seguir
// siendo las del esquema de Drizzle. Si alguien agrega una columna a db/schema.ts y no aquí,
// esta prueba lo dice antes de que una importación falle en local.
// ---------------------------------------------------------------------------------------------

test("las columnas del importador siguen coincidiendo con db/schema.ts", () => {
  const pairs: [readonly string[], object, string][] = [
    [SOURCE_COLUMNS, supplierCatalogSources, "supplier_catalog_sources"],
    [ITEM_COLUMNS, supplierHardwareItems, "supplier_hardware_items"],
    [PRICE_COLUMNS, supplierHardwarePrices, "supplier_hardware_prices"],
    [DOC_COLUMNS, supplierHardwareDocs, "supplier_hardware_docs"],
  ];
  for (const [declared, table, name] of pairs) {
    const actual = Object.values(getTableColumns(table as never)).map((column) => (column as { name: string }).name);
    assert.deepEqual([...declared].sort(), actual.sort(), `columnas de ${name}`);
  }
});

// ---------------------------------------------------------------------------------------------
// Escritura, versionado y modelo de datos
// ---------------------------------------------------------------------------------------------

test("escribe la fuente, los artículos y los precios de la revisión", () => {
  const db = freshDb();
  const items = sampleItems();
  const report = inTransaction(db, () => writePriceList(db, fixtureSource(), items));

  assert.equal(report.sourceInserted, true);
  assert.equal(report.itemsInserted, items.length);
  assert.equal(report.pricesInserted, items.length);
  assert.equal(report.itemsUpdated, 0);
  assert.equal(report.pricesUpdated, 0);
  assert.equal(count(db, "supplier_catalog_sources"), 1);
  assert.equal(count(db, "supplier_hardware_items"), items.length);
  assert.equal(count(db, "supplier_hardware_prices"), items.length);
  db.close();
});

test("MACO queda como proveedor de herrajes compatible con la marca Aluplast", () => {
  const db = freshDb();
  inTransaction(db, () => writePriceList(db, fixtureSource(), sampleItems()));

  const source = db
    .prepare("SELECT supplier, brand, source_type, currency, terms, revision, effective_date FROM supplier_catalog_sources")
    .get() as Record<string, string>;
  assert.equal(source.supplier, "MACO", "MACO es el proveedor de herrajes");
  assert.equal(source.brand, "Aluplast", "Aluplast es la marca de perfiles compatible");
  assert.equal(source.source_type, "lista-precios");
  assert.equal(source.currency, "EUR");
  assert.equal(source.terms, "EXWORK Veracruz/México");
  assert.equal(source.revision, "ABR_22");
  assert.equal(source.effective_date, "2022-05-01");

  // Todo artículo lleva las dos etiquetas: quién lo fabrica y con qué perfiles va.
  const items = db.prepare("SELECT DISTINCT supplier, brand FROM supplier_hardware_items").all();
  assert.deepEqual(plain(items), [{ supplier: "MACO", brand: "Aluplast" }]);
  db.close();
});

test("la revisión ABR_22 entra histórica e inactiva", () => {
  const db = freshDb();
  inTransaction(db, () => writePriceList(db, fixtureSource(), sampleItems()));

  const state = db.prepare("SELECT active, historical FROM supplier_catalog_sources").get() as {
    active: number;
    historical: number;
  };
  assert.equal(state.active, 0, "ser la única revisión no la vuelve la lista con la que se cotiza");
  assert.equal(state.historical, 1);
  db.close();
});

test("el SKU se guarda como texto en la base y conserva los ceros iniciales", () => {
  const db = freshDb();
  inTransaction(db, () => writePriceList(db, fixtureSource(), sampleItems()));

  const row = db.prepare("SELECT sku, typeof(sku) AS kind FROM supplier_hardware_items WHERE sku = '0012'").get() as
    | { sku: string; kind: string }
    | undefined;
  assert.ok(row, "el SKU con ceros iniciales no se encontró");
  assert.equal(row.sku, "0012");
  assert.equal(row.kind, "text");

  const alpha = db.prepare("SELECT sku FROM supplier_hardware_items WHERE sku = 'X11092'").get();
  assert.ok(alpha, "el SKU alfanumérico no se encontró");
  db.close();
});

test("el precio se guarda exacto: texto canónico más entero y escala", () => {
  const db = freshDb();
  inTransaction(db, () => writePriceList(db, fixtureSource(), sampleItems()));

  const row = db
    .prepare(
      `SELECT p.unit_price, typeof(p.unit_price) AS kind, p.unit_price_minor, p.price_scale, p.currency, p.source_row
         FROM supplier_hardware_prices p
         JOIN supplier_hardware_items i ON i.id = p.item_id
        WHERE i.sku = '100528'`
    )
    .get() as Record<string, string | number>;

  assert.equal(row.unit_price, "11.38", "el precio no debe ser 11.379999999999999");
  assert.equal(row.kind, "text", "la fuente de verdad del precio no es un REAL binario");
  assert.equal(row.unit_price_minor, 1138);
  assert.equal(row.price_scale, 2);
  assert.equal(row.currency, "EUR");
  assert.equal(row.source_row, 6, "se conserva la fila de origen para trazabilidad");
  db.close();
});

test("una revisión nueva agrega precios y no destruye el histórico", () => {
  const db = freshDb();
  const items = sampleItems();
  inTransaction(db, () => writePriceList(db, fixtureSource(), items));

  // Segunda revisión: mismo catálogo de artículos, otro archivo, otros precios.
  const nueva = items.map((item) => ({
    ...item,
    price: { text: "99.99", minor: 9999, scale: 2 },
  }));
  const report = inTransaction(db, () =>
    writePriceList(
      db,
      fixtureSource({ fileHash: "b".repeat(64), revision: "ENE_26", effectiveDate: "2026-01-01", fileName: "lista-2026.xlsx" }),
      nueva
    )
  );

  assert.equal(report.sourceInserted, true);
  assert.equal(report.itemsInserted, 0, "los artículos son los mismos: no se duplican");
  assert.equal(report.pricesInserted, items.length, "los precios sí se agregan como versión nueva");
  assert.equal(count(db, "supplier_catalog_sources"), 2);
  assert.equal(count(db, "supplier_hardware_items"), items.length);
  assert.equal(count(db, "supplier_hardware_prices"), items.length * 2);

  // El precio de 2022 sigue ahí.
  const historico = db
    .prepare(
      `SELECT p.unit_price FROM supplier_hardware_prices p
         JOIN supplier_hardware_items i ON i.id = p.item_id
         JOIN supplier_catalog_sources s ON s.id = p.source_id
        WHERE i.sku = '100528' AND s.revision = 'ABR_22'`
    )
    .get() as { unit_price: string };
  assert.equal(historico.unit_price, "11.38", "la revisión nueva no debe sobrescribir el precio histórico");
  db.close();
});

// ---------------------------------------------------------------------------------------------
// Idempotencia y transacción
// ---------------------------------------------------------------------------------------------

test("reimportar el mismo archivo no duplica ni cambia nada", () => {
  const db = freshDb();
  const items = sampleItems();
  inTransaction(db, () => writePriceList(db, fixtureSource(), items));

  const second = inTransaction(db, () => writePriceList(db, fixtureSource(), items));
  assert.equal(second.sourceInserted, false, "la fuente se reconoce por su hash");
  assert.equal(second.itemsInserted, 0);
  assert.equal(second.itemsUpdated, 0);
  assert.equal(second.pricesInserted, 0);
  assert.equal(second.pricesUpdated, 0);

  const third = inTransaction(db, () => writePriceList(db, fixtureSource(), items));
  assert.equal(third.pricesInserted, 0);

  assert.equal(count(db, "supplier_catalog_sources"), 1);
  assert.equal(count(db, "supplier_hardware_items"), items.length);
  assert.equal(count(db, "supplier_hardware_prices"), items.length);
  db.close();
});

test("una descripción corregida actualiza el artículo sin duplicarlo", () => {
  const db = freshDb();
  const items = sampleItems();
  inTransaction(db, () => writePriceList(db, fixtureSource(), items));

  const corregidos = items.map((item) =>
    item.sku === "100528" ? { ...item, description: "Manilla balconera de placa larga Harmony" } : item
  );
  const report = inTransaction(db, () => writePriceList(db, fixtureSource(), corregidos));

  assert.equal(report.itemsUpdated, 1);
  assert.equal(report.itemsInserted, 0);
  assert.equal(count(db, "supplier_hardware_items"), items.length);
  const row = db.prepare("SELECT description FROM supplier_hardware_items WHERE sku = '100528'").get() as {
    description: string;
  };
  assert.equal(row.description, "Manilla balconera de placa larga Harmony");
  db.close();
});

test("la misma revisión desde otro archivo se rechaza en vez de duplicarse", () => {
  const db = freshDb();
  const items = sampleItems();
  inTransaction(db, () => writePriceList(db, fixtureSource(), items));

  assert.throws(
    () => inTransaction(db, () => writePriceList(db, fixtureSource({ fileHash: "c".repeat(64) }), items)),
    /ya está importada desde otro archivo/
  );
  assert.equal(count(db, "supplier_catalog_sources"), 1);
  db.close();
});

test("un fallo a la mitad deshace toda la importación", () => {
  const db = freshDb();
  const items = sampleItems();

  assert.throws(() => {
    inTransaction(db, () => {
      writePriceList(db, fixtureSource(), items);
      // Algo falla DESPUÉS de escribir la lista completa: por ejemplo el registro de manuales.
      throw new Error("fallo simulado a mitad de la importación");
    });
  }, /fallo simulado/);

  assert.equal(count(db, "supplier_catalog_sources"), 0, "la fuente no debe quedar escrita");
  assert.equal(count(db, "supplier_hardware_items"), 0);
  assert.equal(count(db, "supplier_hardware_prices"), 0, "no deben quedar precios huérfanos");
  db.close();
});

test("el mismo artículo repetido dentro de una escritura no lo duplica", () => {
  const db = freshDb();
  const items = sampleItems();

  // Los ids derivados hacen que la escritura sea idempotente incluso dentro de una misma
  // transacción: la segunda aparición encuentra la fila que acaba de escribirse.
  const report = inTransaction(db, () => writePriceList(db, fixtureSource(), [...items, items[0]]));

  assert.equal(report.pricesInserted, items.length);
  assert.equal(report.pricesUpdated, 0);
  assert.equal(count(db, "supplier_hardware_prices"), items.length);
  db.close();
});

test("la base rechaza dos precios del mismo artículo y revisión, y la transacción se deshace", () => {
  const db = freshDb();
  const items = sampleItems();
  const source = fixtureSource();
  const report = inTransaction(db, () => writePriceList(db, source, items));

  // La unicidad de (artículo, fuente) tiene que vivir en la base y no solo en el parser: es lo
  // que impide que la misma revisión termine con dos precios para el mismo SKU.
  const before = count(db, "supplier_hardware_prices");
  assert.throws(() => {
    inTransaction(db, () => {
      db.prepare(
        `INSERT INTO supplier_hardware_prices
           (id, item_id, source_id, unit_price, unit_price_minor, price_scale, currency, effective_date, terms, source_row)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        "prc-otro-id", itemId(SUPPLIER, items[0].sku), report.sourceId,
        "99.99", 9999, 2, "EUR", "2022-05-01", TERMS, 999
      );
    });
  }, /UNIQUE constraint failed/);

  assert.equal(count(db, "supplier_hardware_prices"), before, "el precio rechazado no debe quedar escrito");
  db.close();
});

test("los identificadores son derivados del contenido y por eso estables", () => {
  // Es el mecanismo de la idempotencia: mismo proveedor y SKU, mismo id, en cualquier corrida.
  assert.equal(itemId("MACO", "100528"), itemId("MACO", "100528"));
  assert.notEqual(itemId("MACO", "100528"), itemId("MACO", "100529"));
  assert.notEqual(itemId("MACO", "0012"), itemId("MACO", "12"), "0012 y 12 son códigos distintos");
});

// ---------------------------------------------------------------------------------------------
// Mapeos y manuales
// ---------------------------------------------------------------------------------------------

test("la tabla de mapeos nace vacía: sin manual no hay lista de materiales", () => {
  const db = freshDb();
  inTransaction(db, () => writePriceList(db, fixtureSource(), sampleItems()));

  assert.equal(count(db, "supplier_hardware_mappings"), 0);
  assert.ok(getTableColumns(supplierHardwareMappings), "la tabla existe para cuando lleguen los manuales");
  db.close();
});

test("una carpeta de manuales vacía o inexistente da cero y no rompe la importación", () => {
  const vacia = mkdtempSync(join(workspace, "manuales-"));
  assert.deepEqual(scanManuals(vacia), []);
  assert.deepEqual(scanManuals(join(workspace, "no-existe")), []);

  const db = freshDb();
  const report = inTransaction(db, () => {
    const written = writePriceList(db, fixtureSource(), sampleItems());
    written.docsInserted = writeManuals(db, SUPPLIER, BRAND, "ABR_22", scanManuals(vacia));
    return written;
  });
  assert.equal(report.docsInserted, 0);
  assert.equal(count(db, "supplier_hardware_docs"), 0);
  assert.ok(report.pricesInserted > 0, "la ausencia de manuales no debe bloquear los precios");
  db.close();
});

test("registra los manuales con su hash cuando la carpeta trae archivos", () => {
  const directory = mkdtempSync(join(workspace, "manuales-con-"));
  writeFileSync(join(directory, "montaje-corredera.txt"), "Herraje MACO para corredera. Página 4.");

  const manuals = scanManuals(directory);
  assert.equal(manuals.length, 1);
  assert.equal(manuals[0].name, "montaje-corredera.txt");
  assert.match(manuals[0].fileHash, /^[0-9a-f]{64}$/);
  assert.equal(manuals[0].extractionStatus, "extraido");
  assert.match(manuals[0].extractedText, /Página 4/);

  const db = freshDb();
  const inserted = inTransaction(db, () => writeManuals(db, SUPPLIER, BRAND, "ABR_22", manuals));
  assert.equal(inserted, 1);
  // Idempotente igual que los precios: el mismo archivo no se registra dos veces.
  assert.equal(inTransaction(db, () => writeManuals(db, SUPPLIER, BRAND, "ABR_22", manuals)), 0);
  assert.equal(count(db, "supplier_hardware_docs"), 1);

  const row = db.prepare("SELECT supplier, brand, extraction_status FROM supplier_hardware_docs").get() as Record<string, string>;
  assert.equal(row.supplier, "MACO");
  assert.equal(row.brand, "Aluplast");
  db.close();
});

test("nada de la hoja orden llega a la base", () => {
  const db = freshDb();
  inTransaction(db, () => writePriceList(db, fixtureSource(), sampleItems()));

  for (const table of ["supplier_catalog_sources", "supplier_hardware_items", "supplier_hardware_prices"]) {
    const dump = JSON.stringify(db.prepare(`SELECT * FROM ${table}`).all());
    assert.ok(!dump.includes(ORDEN_SENTINEL), `${table} contiene el RFC señuelo de la hoja orden`);
    assert.ok(!dump.includes("Señuelo"), `${table} contiene datos de la hoja orden`);
    assert.ok(!dump.includes("CLABE"), `${table} contiene datos bancarios de la hoja orden`);
  }
  db.close();
});
