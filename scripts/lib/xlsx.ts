// Lector mínimo de .xlsx para el importador. Solo Node: usa node:zlib, así que vive en
// scripts/ y no en lib/ -- nada de esto debe poder acabar en el bundle del Worker.
//
// Se escribió a mano en vez de agregar una dependencia por dos razones. La primera es que un
// .xlsx es un zip de XML y aquí solo se necesita leer una hoja de celdas planas, que es la parte
// fácil del formato. La segunda es la que decide: este importador lee un libro que contiene una
// hoja con datos bancarios y domicilio de un cliente, y la garantía de que esa hoja no se toca
// tiene que ser verificable leyendo el código. `readSheetByName` resuelve nombre -> r:id ->
// archivo y descomprime ESE archivo; las demás hojas nunca se descomprimen ni se recorren.
//
// Deliberadamente NO soporta: fórmulas (se lee el valor cacheado), fechas (no hay ninguna en la
// hoja de precios), ni celdas combinadas. Si algún día hacen falta, es mejor pagarlas entonces.

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

type ZipEntry = { method: number; compressedSize: number; localOffset: number };

/** Valor de una celda ya resuelto a texto, más el tipo declarado por el propio XML. */
export type SheetCell = {
  /** Texto crudo tal como lo guardó la hoja de cálculo. Sin normalizar a propósito. */
  raw: string;
  /** `true` cuando la celda es numérica (no venía de la tabla de cadenas ni de un inline). */
  numeric: boolean;
};

/** Una fila de la hoja. `cells` va indexado por número de columna 1-based (A=1). */
export type SheetRow = {
  /** Número de fila del Excel, 1-based. Es el que se guarda para trazabilidad. */
  number: number;
  cells: Map<number, SheetCell>;
};

function findEndOfCentralDirectory(buffer: Buffer): number {
  // El EOCD está al final pero puede llevar comentario detrás, así que se busca hacia atrás.
  const earliest = Math.max(0, buffer.length - 0xffff - 22);
  for (let i = buffer.length - 22; i >= earliest; i--) {
    if (buffer.readUInt32LE(i) === SIG_EOCD) return i;
  }
  throw new Error("El archivo no es un .xlsx válido: no se encontró el directorio del zip.");
}

function readCentralDirectory(buffer: Buffer): Map<string, ZipEntry> {
  const eocd = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, ZipEntry>();

  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== SIG_CENTRAL) {
      throw new Error("El archivo no es un .xlsx válido: entrada de directorio corrupta.");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.set(name, { method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function inflateEntry(buffer: Buffer, entry: ZipEntry): string {
  if (buffer.readUInt32LE(entry.localOffset) !== SIG_LOCAL) {
    throw new Error("El archivo no es un .xlsx válido: cabecera local corrupta.");
  }
  const nameLength = buffer.readUInt16LE(entry.localOffset + 26);
  const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return raw.toString("utf8");
  if (entry.method === 8) return inflateRawSync(raw).toString("utf8");
  throw new Error(`El .xlsx usa una compresión no soportada (método ${entry.method}).`);
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" };

function unescapeXml(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(lt|gt|quot|apos|amp));/g, (all, dec, hex, name) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    return ENTITIES[name as string] ?? all;
  });
}

/** Concatena los `<t>` de un fragmento: una cadena con formato viene partida en varios runs. */
function joinTextRuns(fragment: string): string {
  let out = "";
  for (const match of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += match[1];
  return unescapeXml(out);
}

function readSharedStrings(buffer: Buffer, entries: Map<string, ZipEntry>): string[] {
  const entry = entries.get("xl/sharedStrings.xml");
  if (!entry) return [];
  const xml = inflateEntry(buffer, entry);
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) strings.push(joinTextRuns(match[1]));
  return strings;
}

/** "A" -> 1, "Z" -> 26, "AA" -> 27. Ignora el número de fila de la referencia. */
export function columnNumber(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref);
  if (!letters) return 0;
  let n = 0;
  for (const ch of letters[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/**
 * Recorre las celdas de un fragmento `<row>`. Se hace buscando la etiqueta de apertura y luego
 * su cierre en vez de con una sola expresión regular: una `<c .../>` vacía seguida de una `<c>`
 * con contenido hace que un patrón ingenuo del tipo `<c[^>]*>(.*?)</c>` se coma la celda vacía
 * junto con la siguiente y atribuya el valor a la columna equivocada -- lo que en esta hoja
 * significaba leer la descripción como si fuera la clave alterna.
 */
function parseCells(rowXml: string, shared: string[]): Map<number, SheetCell> {
  const cells = new Map<number, SheetCell>();
  const openTag = /<c\s([^>]*?)(\/?)>/g;
  let match: RegExpExecArray | null;

  while ((match = openTag.exec(rowXml)) !== null) {
    const attrs = match[1];
    const selfClosing = match[2] === "/";
    const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
    if (!ref) continue;

    let inner = "";
    if (!selfClosing) {
      // Las celdas no se anidan, así que el siguiente `</c>` es el propio cierre.
      const close = rowXml.indexOf("</c>", openTag.lastIndex);
      if (close === -1) continue;
      inner = rowXml.slice(openTag.lastIndex, close);
      openTag.lastIndex = close + 4;
    }
    if (!inner) continue;

    const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
    let raw: string;
    let numeric = false;

    if (type === "s") {
      const index = Number(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "");
      raw = shared[index] ?? "";
    } else if (type === "inlineStr") {
      raw = joinTextRuns(inner);
    } else if (type === "str") {
      raw = unescapeXml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "");
    } else if (type === "b" || type === "e") {
      raw = unescapeXml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "");
    } else {
      raw = unescapeXml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "");
      numeric = raw !== "";
    }

    if (raw !== "") cells.set(columnNumber(ref), { raw, numeric });
  }
  return cells;
}

export type Workbook = {
  /** Nombres de las hojas, en el orden del libro. Sirve para verificar, no para recorrer. */
  sheetNames: string[];
  /**
   * Lee UNA hoja por nombre. Lanza si no existe. Es el único camino a los datos de este módulo:
   * no hay `readAllSheets`, y eso es intencional -- ver la nota de cabecera.
   */
  readSheetByName(name: string): SheetRow[];
};

export function openWorkbook(filePath: string): Workbook {
  const buffer = readFileSync(filePath);
  const entries = readCentralDirectory(buffer);

  const workbookEntry = entries.get("xl/workbook.xml");
  if (!workbookEntry) throw new Error("El archivo no es un .xlsx válido: falta xl/workbook.xml.");
  const workbookXml = inflateEntry(buffer, workbookEntry);

  const relsEntry = entries.get("xl/_rels/workbook.xml.rels");
  if (!relsEntry) throw new Error("El archivo no es un .xlsx válido: faltan las relaciones del libro.");
  const relsXml = inflateEntry(buffer, relsEntry);

  const targetByRelId = new Map<string, string>();
  for (const match of relsXml.matchAll(/<Relationship\s([^>]*)\/?>/g)) {
    const attrs = match[1];
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    if (id && target) targetByRelId.set(id, target);
  }

  // nombre de hoja -> r:id. Se guarda el mapa completo solo para poder reportar los nombres y
  // fallar con un mensaje claro; leer sigue exigiendo pedir una hoja por nombre.
  const relIdBySheetName = new Map<string, string>();
  for (const match of workbookXml.matchAll(/<sheet\s([^>]*)\/?>/g)) {
    const attrs = match[1];
    const name = /\bname="([^"]*)"/.exec(attrs)?.[1];
    const relId = /\br:id="([^"]+)"/.exec(attrs)?.[1];
    if (name !== undefined && relId) relIdBySheetName.set(unescapeXml(name), relId);
  }

  let shared: string[] | null = null;

  return {
    sheetNames: [...relIdBySheetName.keys()],

    readSheetByName(name: string): SheetRow[] {
      const relId = relIdBySheetName.get(name);
      if (!relId) {
        throw new Error(`El libro no tiene una hoja llamada "${name}". Hojas: ${[...relIdBySheetName.keys()].join(", ")}.`);
      }
      const target = targetByRelId.get(relId);
      if (!target) throw new Error(`La hoja "${name}" no apunta a ningún archivo dentro del libro.`);

      const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
      const sheetEntry = entries.get(path);
      if (!sheetEntry) throw new Error(`No se encontró ${path} dentro del libro.`);

      shared ??= readSharedStrings(buffer, entries);
      const sheetXml = inflateEntry(buffer, sheetEntry);

      const rows: SheetRow[] = [];
      const rowOpen = /<row\s([^>]*?)(\/?)>/g;
      let match: RegExpExecArray | null;

      while ((match = rowOpen.exec(sheetXml)) !== null) {
        const number = Number(/\br="(\d+)"/.exec(match[1])?.[1] ?? "0");
        if (match[2] === "/") {
          if (number > 0) rows.push({ number, cells: new Map() });
          continue;
        }
        const close = sheetXml.indexOf("</row>", rowOpen.lastIndex);
        const inner = close === -1 ? sheetXml.slice(rowOpen.lastIndex) : sheetXml.slice(rowOpen.lastIndex, close);
        if (close !== -1) rowOpen.lastIndex = close + 6;
        if (number > 0) rows.push({ number, cells: parseCells(inner, shared) });
      }
      return rows;
    },
  };
}
