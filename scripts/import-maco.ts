// Importador de la lista de precios de herrajes MACO para sistemas Aluplast.
//
// Uso:
//   npm run maco:import:dry -- --file="<ruta>"   -- lee y reporta, no escribe nada
//   npm run maco:import     -- --file="<ruta>"   -- escribe en la D1 LOCAL
//
//   node --import ./tests/register-ts-loader.mjs scripts/import-maco.ts \
//     --file="<ruta al .xlsx o al .lnk>" [--dry-run] [--manuals="<carpeta>"] [--db-file="<sqlite>"]
//
// La ruta se pasa siempre a mano y NO tiene valor por omisión: tenerla escrita en package.json
// ataba el repositorio a una computadora concreta y fallaba en cualquier otra.
//
// Acepta tanto el .xlsx como el acceso directo .lnk de Windows que apunta a él (es lo que entrega
// la carpeta de archivos recientes de Office); en ese caso resuelve el destino y abre el libro
// real, nunca los bytes del atajo. Ver scripts/lib/shortcut.ts.
//
// LA HOJA "orden" NO SE LEE. El mismo libro trae una hoja con RFC, domicilio, contactos, datos
// bancarios y cantidades del pedido de un cliente. Este script pide la hoja "precio" por nombre
// (`assertSheetAllowed` + `readSheetByName`), así que "orden" no se descomprime, no se recorre y
// no puede aparecer en el reporte ni en un mensaje de error. Tampoco se copia el Excel al
// repositorio: se lee desde su ubicación y se guardan hash y metadatos.
//
// Solo escribe en LOCAL. No hay bandera para apuntar a la base remota; eso se hace con
// `wrangler d1 migrations apply` y una decisión humana. Ver el informe del importador al final.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  BRAND,
  CURRENCY,
  SHEET_PRECIO,
  SUPPLIER,
  TERMS,
  assertSheetAllowed,
  parsePriceList,
} from "../lib/maco/priceList";
import { inTransaction, openLocalD1 } from "./lib/localD1";
import { scanManuals } from "./lib/manuals";
import { writeManuals, writePriceList } from "./lib/macoWriter";
import { resolveShortcut } from "./lib/shortcut";
import { openWorkbook } from "./lib/xlsx";

/**
 * Carpeta destinada a la documentación técnica de herrajes MACO para Aluplast.
 *
 * Es una comodidad para la máquina donde vive hoy esa carpeta, no un requisito: si no existe,
 * `scanManuals` devuelve una lista vacía sin fallar y la importación de precios sigue igual. En
 * otra computadora se pasa `--manuals="<carpeta>"`.
 */
const DEFAULT_MANUALS_DIR =
  "C:/Users/jsald/Desktop/04 - Recursos y plantillas/CATALOGOS/ALUPLAST MX/MANUAL MACO";

const SOURCE_TYPE = "lista-precios";

function parseArgs(argv: string[]): { file: string; dryRun: boolean; manualsDir: string; dbFile?: string } {
  let file = "";
  let manualsDir = DEFAULT_MANUALS_DIR;
  let dbFile: string | undefined;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--file=")) file = arg.slice(7);
    else if (arg.startsWith("--manuals=")) manualsDir = arg.slice(10);
    else if (arg.startsWith("--db-file=")) dbFile = arg.slice(10);
    else throw new Error(`Argumento no reconocido: ${arg}`);
  }
  if (!file) {
    throw new Error(
      "Falta --file=<ruta>. Acepta el .xlsx de la lista o el acceso directo .lnk que apunta a él."
    );
  }
  return { file, dryRun, manualsDir, dbFile };
}

function formatCount(label: string, value: number | string): string {
  return `  ${label.padEnd(34, ".")} ${value}`;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  // 1. Resolver el acceso directo si hace falta, y comprobar que el libro existe.
  const workbookPath = resolveShortcut(resolve(options.file), ["xlsx"]);
  if (!existsSync(workbookPath)) throw new Error(`No existe el archivo: ${workbookPath}`);
  const stats = statSync(workbookPath);

  // 2. Hash del archivo: es la llave de idempotencia y la huella que queda en la fuente.
  const bytes = readFileSync(workbookPath);
  const fileHash = createHash("sha256").update(bytes).digest("hex");

  // 3. Leer ÚNICAMENTE la hoja "precio".
  assertSheetAllowed(SHEET_PRECIO);
  const workbook = openWorkbook(workbookPath);
  const rows = workbook.readSheetByName(SHEET_PRECIO);
  const parsed = parsePriceList(rows);

  // 4. Un mismo SKU con dos precios distintos en la misma revisión no se puede resolver
  //    adivinando: se detiene antes de escribir nada.
  if (parsed.conflicts.length > 0) {
    const detail = parsed.conflicts
      .slice(0, 10)
      .map((c) => `  SKU ${c.sku}: ${c.firstPrice} (fila ${c.firstRow}) vs ${c.price} (fila ${c.row})`)
      .join("\n");
    throw new Error(
      `La hoja "${SHEET_PRECIO}" tiene ${parsed.conflicts.length} SKU con precios distintos en la misma revisión:\n${detail}\n` +
        "Corrige la lista o decide cuál precio rige antes de importar."
    );
  }

  const manuals = scanManuals(options.manualsDir);

  console.log(`\nHerrajes MACO para sistemas Aluplast — lista de precios`);
  console.log(`${"─".repeat(64)}`);
  console.log(formatCount("Archivo procesado", basename(workbookPath)));
  if (workbookPath !== resolve(options.file)) {
    console.log(formatCount("Acceso directo resuelto", basename(options.file)));
  }
  console.log(formatCount("SHA-256", fileHash));
  console.log(formatCount("Tamaño (bytes)", stats.size));
  console.log(formatCount("Hoja leída", SHEET_PRECIO));
  console.log(formatCount("Revisión", parsed.metadata.revision));
  console.log(formatCount("Fecha efectiva", parsed.metadata.effectiveDate));
  console.log(formatCount("Moneda", CURRENCY));
  console.log(formatCount("Condición", TERMS));
  console.log(formatCount("Proveedor de herrajes", SUPPLIER));
  console.log(formatCount("Marca compatible", BRAND));
  console.log(`${"─".repeat(64)}`);
  console.log(formatCount("Fila de encabezados", parsed.headerRow));
  console.log(formatCount("Filas examinadas", parsed.stats.examined));
  console.log(formatCount("Filas válidas", parsed.stats.valid));
  console.log(formatCount("Filas omitidas (vacías)", parsed.stats.skipped));
  console.log(formatCount("Filas rechazadas", parsed.stats.rejected));
  console.log(formatCount("Duplicados (mismo precio)", parsed.stats.duplicates));
  console.log(formatCount("Conflictos de precio", parsed.conflicts.length));
  console.log(formatCount("SKU únicos", parsed.stats.uniqueSkus));
  console.log(formatCount("Manuales MACO encontrados", manuals.length));

  if (parsed.rejected.length > 0) {
    console.log("\n  Filas rechazadas:");
    for (const row of parsed.rejected.slice(0, 20)) console.log(`    fila ${row.row}: ${row.reason}`);
    if (parsed.rejected.length > 20) console.log(`    … y ${parsed.rejected.length - 20} más`);
  }
  if (parsed.duplicates.length > 0) {
    console.log("\n  SKU repetidos con precio idéntico (se conserva la primera aparición):");
    for (const row of parsed.duplicates.slice(0, 20)) {
      console.log(`    fila ${row.row}: SKU ${row.sku} ya estaba en la fila ${row.firstRow}`);
    }
  }

  if (options.dryRun) {
    console.log(`${"─".repeat(64)}`);
    console.log("  MODO --dry-run: no se escribió nada en la base.");
    console.log(`  Estado que tendría la revisión: histórica, NO vigente para cotización.\n`);
    return;
  }

  // 5. Escritura transaccional en la D1 local.
  const { path: dbPath, db } = openLocalD1(options.dbFile);
  try {
    const report = inTransaction(db, () => {
      const written = writePriceList(
        db,
        {
          sourceType: SOURCE_TYPE,
          supplier: SUPPLIER,
          brand: BRAND,
          fileName: basename(workbookPath),
          fileHash,
          fileSize: stats.size,
          fileModifiedAt: stats.mtime.toISOString(),
          revision: parsed.metadata.revision,
          effectiveDate: parsed.metadata.effectiveDate,
          currency: CURRENCY,
          terms: TERMS,
          // Histórica y NO vigente. Ser la única revisión disponible no la vuelve la lista con la
          // que se cotiza: activarla es una decisión comercial explícita.
          active: 0,
          historical: 1,
        },
        parsed.items
      );
      written.docsInserted = writeManuals(db, SUPPLIER, BRAND, parsed.metadata.revision, manuals);
      return written;
    });

    const state = db
      .prepare("SELECT active, historical FROM supplier_catalog_sources WHERE id = ?")
      .get(report.sourceId) as { active: number; historical: number };

    console.log(`${"─".repeat(64)}`);
    console.log(formatCount("Base local", dbPath));
    console.log(formatCount("Fuente", report.sourceInserted ? "insertada" : "ya existía (reimportación)"));
    console.log(formatCount("Artículos insertados", report.itemsInserted));
    console.log(formatCount("Artículos actualizados", report.itemsUpdated));
    console.log(formatCount("Precios insertados", report.pricesInserted));
    console.log(formatCount("Precios actualizados", report.pricesUpdated));
    console.log(formatCount("Manuales registrados", report.docsInserted));
    console.log(
      formatCount("Estado de la revisión", `${state.historical ? "histórica" : "vigente"}, ${state.active ? "ACTIVA" : "no activa"}`)
    );
    console.log("");
  } finally {
    db.close();
  }
}

try {
  main();
} catch (error) {
  // Solo el mensaje: un stack trace de este script no aporta nada al operador, y el mensaje ya
  // está redactado para explicar qué hacer.
  console.error(`\nLa importación no se realizó: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
