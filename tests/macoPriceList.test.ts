import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import {
  BRAND,
  CURRENCY,
  FORBIDDEN_SHEETS,
  SHEET_PRECIO,
  SUPPLIER,
  TERMS,
  assertSheetAllowed,
  findHeaderRow,
  normalizeSku,
  normalizeText,
  parsePriceList,
} from "@/lib/maco/priceList";
import { openWorkbook } from "@/scripts/lib/xlsx";
import {
  DEFAULT_HEADER_ROWS,
  ORDEN_SENTINEL,
  SAMPLE_ROWS,
  buildWorkbook,
} from "./fixtures/macoWorkbook";

const workspace = mkdtempSync(join(tmpdir(), "maco-pricelist-"));
after(() => rmSync(workspace, { recursive: true, force: true }));

let counter = 0;
function writeWorkbook(rows: (string | number | null)[][], options: { ordenFirst?: boolean } = {}): string {
  const path = join(workspace, `libro-${counter++}.xlsx`);
  writeFileSync(path, buildWorkbook({ precio: rows, ordenFirst: options.ordenFirst }));
  return path;
}

function readPrecio(path: string) {
  return openWorkbook(path).readSheetByName(SHEET_PRECIO);
}

test("identifica la marca y el proveedor sin confundirlos", () => {
  // MACO fabrica los herrajes; Aluplast es la marca de los perfiles. Invertirlo es el error que
  // convertiría esta lista en una línea de perfiles inexistente.
  assert.equal(SUPPLIER, "MACO");
  assert.equal(BRAND, "Aluplast");
  assert.equal(CURRENCY, "EUR");
  assert.equal(TERMS, "EXWORK Veracruz/México");
});

test("encuentra la fila de encabezados sin dar por hecho que es la quinta", () => {
  const rows = readPrecio(writeWorkbook([...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS]));
  const header = findHeaderRow(rows);
  assert.ok(header);
  assert.equal(header.row.number, 5);
  assert.equal(header.columns.sku, 1);
  assert.equal(header.columns.altKey, 2);
  assert.equal(header.columns.description, 3);
  assert.equal(header.columns.unitPrice, 7);
});

test("encuentra los encabezados cuando la portada cambia de alto", () => {
  // Una revisión posterior puede agregar o quitar renglones de portada: la fila del encabezado se
  // busca, no se asume.
  const conPortadaLarga = [
    ["PRICE EXWORK VERACRUZ/MEXICO - (EUROS)"],
    ["Nota adicional del proveedor"],
    ["Otra nota"],
    ["Revision ABR_22 (01/05/2022) "],
    [],
    [],
    ["codigo", "clave alterna", "descripcion", "unidad", "pres.", "cant/pres.", "precio un"],
    ...SAMPLE_ROWS,
  ];
  const result = parsePriceList(readPrecio(writeWorkbook(conPortadaLarga)));
  assert.equal(result.headerRow, 7);
  assert.equal(result.stats.valid, SAMPLE_ROWS.length);

  const conPortadaCorta = [
    ["Revision ABR_22 (01/05/2022) "],
    ["codigo", "clave alterna", "descripcion", "unidad", "pres.", "cant/pres.", "precio un"],
    ...SAMPLE_ROWS,
  ];
  const corto = parsePriceList(readPrecio(writeWorkbook(conPortadaCorta)));
  assert.equal(corto.headerRow, 2);
  assert.equal(corto.stats.valid, SAMPLE_ROWS.length);
});

test("lee la revisión y la fecha efectiva del propio archivo", () => {
  const result = parsePriceList(readPrecio(writeWorkbook([...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS])));
  assert.equal(result.metadata.revision, "ABR_22");
  // 01/05/2022 es día/mes/año: 1 de mayo de 2022.
  assert.equal(result.metadata.effectiveDate, "2022-05-01");
});

test("no importa si el archivo no declara revisión ni fecha", () => {
  const sinRevision = [
    ["PRICE EXWORK VERACRUZ/MEXICO - (EUROS)"],
    ["codigo", "clave alterna", "descripcion", "unidad", "pres.", "cant/pres.", "precio un"],
    ...SAMPLE_ROWS,
  ];
  assert.throws(
    () => parsePriceList(readPrecio(writeWorkbook(sinRevision))),
    /no declara revisión ni fecha efectiva/
  );
});

test("falla claro cuando faltan los encabezados obligatorios", () => {
  const sinEncabezados = [
    ["Revision ABR_22 (01/05/2022) "],
    ["algo", "otra cosa", "tercera"],
    [100528, 14, "Manilla", "pz", "pz", 1, 11.38],
  ];
  assert.throws(() => parsePriceList(readPrecio(writeWorkbook(sinEncabezados))), /encabezados/);
});

// ---------------------------------------------------------------------------------------------
// LA HOJA "orden" NO SE LEE. Contiene RFC, domicilio, contactos y datos bancarios de un cliente.
// ---------------------------------------------------------------------------------------------

test("la hoja prohibida está declarada y se rechaza por nombre", () => {
  assert.deepEqual([...FORBIDDEN_SHEETS], ["orden"]);
  assert.throws(() => assertSheetAllowed("orden"), /información comercial privada/);
  assert.throws(() => assertSheetAllowed("ORDEN"), /información comercial privada/);
  assert.throws(() => assertSheetAllowed(" Orden "), /información comercial privada/);
  // Cualquier hoja que no sea "precio" también se rechaza: la lista es blanca, no negra.
  assert.throws(() => assertSheetAllowed("Hoja3"), /solo lee la hoja/);
  assert.doesNotThrow(() => assertSheetAllowed(SHEET_PRECIO));
});

test("nada de la hoja orden entra en el resultado de la importación", () => {
  const path = writeWorkbook([...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS]);
  const result = parsePriceList(readPrecio(path));

  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes(ORDEN_SENTINEL), "el RFC señuelo de la hoja orden apareció en el resultado");
  assert.ok(!serialized.includes("Señuelo"), "datos de la hoja orden aparecieron en el resultado");
  assert.ok(!serialized.includes("CLABE"), "datos bancarios de la hoja orden aparecieron en el resultado");
  assert.ok(!serialized.includes("999999"), "un artículo de la hoja orden se importó");
  assert.ok(!result.items.some((item) => item.description.includes("no debe importarse")));
});

test("lee la hoja precio por nombre, no por posición en el libro", () => {
  // Con "orden" declarada primero, un lector que tomara "la primera hoja" importaría los datos
  // privados del cliente.
  const path = writeWorkbook([...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS], { ordenFirst: true });
  const workbook = openWorkbook(path);
  assert.deepEqual(workbook.sheetNames, ["orden", "precio"]);

  const result = parsePriceList(workbook.readSheetByName(SHEET_PRECIO));
  assert.equal(result.stats.valid, SAMPLE_ROWS.length);
  assert.ok(!JSON.stringify(result).includes(ORDEN_SENTINEL));
});

test("pedir una hoja que no existe falla en vez de caer en otra", () => {
  const path = writeWorkbook([...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS]);
  assert.throws(() => openWorkbook(path).readSheetByName("precios"), /no tiene una hoja llamada/);
});

// ---------------------------------------------------------------------------------------------
// SKU como texto, precios exactos
// ---------------------------------------------------------------------------------------------

test("el SKU se conserva como texto y con sus ceros iniciales", () => {
  const result = parsePriceList(readPrecio(writeWorkbook([...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS])));
  const skus = result.items.map((item) => item.sku);

  assert.ok(skus.includes("0012"), `se perdieron los ceros iniciales: ${skus.join(", ")}`);
  assert.ok(skus.includes("X11092"), "se perdió el código alfanumérico");
  // Un código numérico llega como "100528.0" desde la hoja de cálculo: el `.0` es formato.
  assert.ok(skus.includes("100528"));
  assert.ok(!skus.includes("100528.0"));
  for (const sku of skus) assert.equal(typeof sku, "string");
});

test("normalizeSku no toca los dígitos de una celda de texto", () => {
  assert.equal(normalizeSku({ raw: "0012", numeric: false }), "0012");
  assert.equal(normalizeSku({ raw: "00.50", numeric: false }), "00.50");
  assert.equal(normalizeSku({ raw: " X11092 ", numeric: false }), "X11092");
  // Numérica: se quita el relleno de la hoja de cálculo.
  assert.equal(normalizeSku({ raw: "100528.0", numeric: true }), "100528");
});

test("el precio se guarda exacto, no como el flotante del archivo", () => {
  const result = parsePriceList(readPrecio(writeWorkbook([...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS])));
  const byId = new Map(result.items.map((item) => [item.sku, item]));

  assert.equal(byId.get("100528")?.price.text, "11.38");
  assert.equal(byId.get("100528")?.price.minor, 1138);
  assert.equal(byId.get("100528")?.price.scale, 2);
  assert.equal(byId.get("0012")?.price.text, "0.15");
  assert.equal(byId.get("235613")?.price.text, "19");
  assert.equal(byId.get("235650")?.price.text, "12.05");

  // Ni un solo precio conserva la basura.
  for (const item of result.items) {
    assert.ok(!item.price.text.includes("999999"), `precio con ruido: ${item.price.text}`);
    assert.ok(!/\.\d{5,}/.test(item.price.text), `precio con exceso de decimales: ${item.price.text}`);
  }
});

test("la celda vacía anterior no desplaza la descripción de columna", () => {
  // El caso que rompía un lector ingenuo: <c/> vacía seguida de <c> con contenido.
  const result = parsePriceList(readPrecio(writeWorkbook([...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS])));
  const item = result.items.find((entry) => entry.sku === "100529");
  assert.ok(item);
  assert.equal(item.altKey, "", "la clave alterna vacía debe quedar vacía");
  assert.equal(item.description, "Compás abatible para tirafondo 204 plata");
});

test("la clave alterna también se limpia del relleno de la hoja de cálculo", () => {
  // El archivo real trae "101408.0" en esta columna. La clave alterna es otro código del
  // proveedor, así que recibe el mismo trato que el SKU: el `.0` es formato, no parte del código.
  const rows = [
    ...DEFAULT_HEADER_ROWS,
    [106016, 101408, "Cerradero para delimitador de apertura", "pz", "pz", 1, 7.48],
    // Clave alterna de TEXTO con ceros iniciales: no se toca.
    [106017, "00407", "Cerradero con clave alterna de texto", "pz", "pz", 1, 7.48],
  ];
  const result = parsePriceList(readPrecio(writeWorkbook(rows)));
  const byId = new Map(result.items.map((item) => [item.sku, item]));

  assert.equal(byId.get("106016")?.altKey, "101408", "la clave alterna no debe quedar como 101408.0");
  assert.equal(byId.get("106017")?.altKey, "00407", "una clave alterna de texto conserva sus ceros");
});

test("conserva unidad, presentación y cantidad por presentación", () => {
  const result = parsePriceList(readPrecio(writeWorkbook([...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS])));
  const tornillo = result.items.find((entry) => entry.sku === "0012");
  assert.ok(tornillo);
  // El precio no se puede interpretar como "por pieza" sin estos tres campos: son 50 por caja.
  assert.equal(tornillo.unit, "pz");
  assert.equal(tornillo.presentation, "caja");
  assert.equal(tornillo.qtyPerPresentation, "50");
});

test("no inventa categoría ni deduce sistema de la descripción", () => {
  const result = parsePriceList(readPrecio(writeWorkbook([...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS])));
  for (const item of result.items) {
    // ParsedItem no tiene campo de categoría/sistema/apertura: la lista no los trae.
    assert.equal(Object.hasOwn(item, "category"), false);
    assert.equal(Object.hasOwn(item, "system"), false);
    assert.equal(Object.hasOwn(item, "wingType"), false);
  }
});

test("normalizeText unifica invisibles sin reescribir la descripción", () => {
  assert.equal(normalizeText("Manilla balconera   larga "), "Manilla balconera larga");
  assert.equal(normalizeText("Compás abatible"), "Compás abatible");
  assert.equal(normalizeText("Tapa​embellecedora"), "Tapaembellecedora");
  // No cambia mayúsculas, acentos ni puntuación.
  assert.equal(normalizeText("Cerradero PICAPORTE - paletón A-TS Dc"), "Cerradero PICAPORTE - paletón A-TS Dc");
});

// ---------------------------------------------------------------------------------------------
// Filas inválidas, duplicados y conflictos
// ---------------------------------------------------------------------------------------------

test("rechaza filas sin código, sin descripción o sin precio válido", () => {
  const rows = [
    ...DEFAULT_HEADER_ROWS,
    [100528, 14, "Manilla válida", "pz", "pz", 1, 11.38],
    [null, 15, "Sin código", "pz", "pz", 1, 9.5],
    [100530, 16, null, "pz", "pz", 1, 9.5],
    [100531, 17, "Sin precio", "pz", "pz", 1, null],
    [100532, 18, "Precio no numérico", "pz", "pz", 1, "consultar"],
    [100533, 19, "Precio negativo", "pz", "pz", 1, -5],
  ];
  const result = parsePriceList(readPrecio(writeWorkbook(rows)));

  assert.equal(result.stats.valid, 1);
  assert.equal(result.stats.rejected, 5);
  assert.deepEqual(
    result.rejected.map((row) => row.reason),
    ["sin código", "sin descripción", "sin precio", "precio no interpretable", "precio negativo"]
  );
});

test("cuenta las filas vacías como omitidas y no como rechazadas", () => {
  const rows = [
    ...DEFAULT_HEADER_ROWS,
    [100528, 14, "Manilla", "pz", "pz", 1, 11.38],
    [],
    [null, null, null, null, null, null, null],
    [100529, 15, "Compás", "pz", "pz", 1, 15.94],
  ];
  const result = parsePriceList(readPrecio(writeWorkbook(rows)));

  assert.equal(result.stats.examined, 4);
  assert.equal(result.stats.valid, 2);
  assert.equal(result.stats.skipped, 2);
  assert.equal(result.stats.rejected, 0);
});

test("no cuenta como examinado el relleno del final de la hoja", () => {
  // La hoja de cálculo real deja elementos <row> vacíos hasta la fila 1000.
  const relleno = Array.from({ length: 40 }, () => [] as (string | number | null)[]);
  const rows = [...DEFAULT_HEADER_ROWS, ...SAMPLE_ROWS, ...relleno];
  const result = parsePriceList(readPrecio(writeWorkbook(rows)));

  assert.equal(result.stats.examined, SAMPLE_ROWS.length);
  assert.equal(result.stats.skipped, 0);
});

test("detecta el mismo SKU repetido con precio idéntico y conserva la primera aparición", () => {
  const rows = [
    ...DEFAULT_HEADER_ROWS,
    [100528, 14, "Manilla balconera", "pz", "pz", 1, 11.38],
    [100529, 15, "Compás abatible", "pz", "pz", 1, 15.94],
    [100528, 14, "Manilla balconera", "pz", "pz", 1, 11.379999999999999],
  ];
  const result = parsePriceList(readPrecio(writeWorkbook(rows)));

  assert.equal(result.stats.valid, 2);
  assert.equal(result.stats.duplicates, 1);
  assert.equal(result.stats.uniqueSkus, 2);
  assert.equal(result.conflicts.length, 0, "11.38 y 11.379999999999999 son el mismo precio");
  assert.deepEqual(result.duplicates, [{ row: 8, sku: "100528", firstRow: 6 }]);
  assert.equal(result.items.find((item) => item.sku === "100528")?.sourceRow, 6);
});

test("detecta el mismo SKU con precios distintos en la misma revisión", () => {
  const rows = [
    ...DEFAULT_HEADER_ROWS,
    [100528, 14, "Manilla balconera", "pz", "pz", 1, 11.38],
    [100528, 14, "Manilla balconera", "pz", "pz", 1, 12.5],
  ];
  const result = parsePriceList(readPrecio(writeWorkbook(rows)));

  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(result.conflicts[0], {
    sku: "100528",
    firstRow: 6,
    firstPrice: "11.38",
    row: 7,
    price: "12.5",
  });
  // El conflicto no se resuelve adivinando: se reporta y el importador se detiene.
  assert.equal(result.stats.duplicates, 0);
});
