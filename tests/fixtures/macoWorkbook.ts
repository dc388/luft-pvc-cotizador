// Generador de libros .xlsx sintéticos para probar el importador de herrajes MACO.
//
// Los fixtures se CONSTRUYEN en memoria en vez de guardar un .xlsx de muestra en el repositorio,
// y la razón es la hoja "orden": el libro real contiene RFC, domicilio, contactos y datos
// bancarios de un cliente. Un fixture "recortado" del original correría el riesgo de arrastrar
// algo de eso, y una copia del archivo real no puede entrar al repositorio. Así que aquí se
// escriben libros con datos inventados que reproducen la ESTRUCTURA del original: portada con
// revisión y fecha, encabezados en una fila que no es la primera, códigos numéricos y de texto,
// precios con la basura de coma flotante que Excel realmente guarda, y una hoja "orden" con
// contenido señuelo que las pruebas usan para verificar que NO se lee.

import { deflateRawSync } from "node:zlib";

type Cell = string | number | null;

/** Escribe un zip mínimo (solo deflate y store) con las entradas dadas. */
function zip(files: { name: string; content: string }[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf8");
    const raw = Buffer.from(file.content, "utf8");
    const deflated = deflateRawSync(raw);
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);

    chunks.push(local, body);

    const entry = Buffer.alloc(46 + nameBytes.length);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(0, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38);
    entry.writeUInt32LE(offset, 42);
    nameBytes.copy(entry, 46);
    central.push(entry);

    offset += local.length + body.length;
  }

  const centralBuffer = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuffer, eocd]);
}

let crcTable: number[] | null = null;
function crc32(buffer: Buffer): number {
  if (!crcTable) {
    crcTable = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnLetter(index: number): string {
  let n = index;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/**
 * Construye la hoja. Las celdas de texto se escriben como `inlineStr` y las numéricas como
 * número crudo, igual que el archivo real: eso es lo que permite probar que un código numérico
 * ("100528") y uno de texto ("0012", con ceros iniciales) se tratan distinto.
 *
 * Una celda `null` se escribe como `<c/>` vacía y con eso se reproduce el caso que rompía un
 * lector ingenuo: una celda vacía seguida de una con contenido.
 */
function sheetXml(rows: Cell[][]): string {
  const body = rows
    .map((cells, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const inner = cells
        .map((cell, columnIndex) => {
          const ref = `${columnLetter(columnIndex + 1)}${rowNumber}`;
          if (cell === null || cell === "") return `<c r="${ref}"/>`;
          if (typeof cell === "number") return `<c r="${ref}"><v>${cell}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowNumber}">${inner}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export type BuildOptions = {
  /** Filas de la hoja "precio", incluyendo portada y encabezados. */
  precio: Cell[][];
  /** Filas de la hoja "orden". Contenido señuelo: las pruebas verifican que no se lee. */
  orden?: Cell[][];
  /** Invierte el orden de las hojas en el libro, para probar que no se lee "la primera". */
  ordenFirst?: boolean;
};

/**
 * Contenido señuelo de la hoja "orden": si alguna prueba lo encuentra en la salida del
 * importador, es que se leyó una hoja que no debía leerse.
 */
export const ORDEN_SENTINEL = "RFC-SENUELO-XAXX010101000";

const DEFAULT_ORDEN: Cell[][] = [
  ["ORDEN DE COMPRA (datos privados de cliente)"],
  ["Cliente", "Cliente Señuelo S.A. de C.V."],
  ["RFC", ORDEN_SENTINEL],
  ["Domicilio", "Calle Señuelo 123, Veracruz"],
  ["Contacto", "senuelo@example.invalid"],
  ["Banco", "CLABE 000000000000000000"],
  ["codigo", "descripcion", "cantidad"],
  ["999999", "Artículo que no debe importarse", 42],
];

/** Portada + encabezados idénticos en forma a los del archivo real. */
export const DEFAULT_HEADER_ROWS: Cell[][] = [
  ["PRICE EXWORK VERACRUZ/MEXICO - (EUROS)", null, null, null, null, null, null, "cambio descripcion "],
  ["Revision ABR_22 (01/05/2022) ", null, null, null, null, null, null, "nuevos"],
  [4],
  [],
  ["codigo", "clave alterna", "descripcion", "unidad", "pres.", "cant/pres.", "precio un", "alerta", "comprobar"],
];

/** Devuelve los bytes de un .xlsx sintético con las hojas "precio" y "orden". */
export function buildWorkbook(options: BuildOptions): Buffer {
  const precioSheet = { name: "xl/worksheets/sheet1.xml", content: sheetXml(options.precio) };
  const ordenSheet = { name: "xl/worksheets/sheet2.xml", content: sheetXml(options.orden ?? DEFAULT_ORDEN) };

  // El orden de <sheet> en el libro y el de los archivos se pueden invertir: el lector tiene que
  // resolver la hoja por NOMBRE -> r:id -> archivo, no por posición.
  const sheets = options.ordenFirst
    ? `<sheet state="visible" name="orden" sheetId="1" r:id="rId2"/><sheet state="visible" name="precio" sheetId="2" r:id="rId1"/>`
    : `<sheet state="visible" name="precio" sheetId="1" r:id="rId1"/><sheet state="visible" name="orden" sheetId="2" r:id="rId2"/>`;

  return zip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`,
    },
    precioSheet,
    ordenSheet,
  ]);
}

/** Filas de datos válidas de ejemplo, con los casos difíciles del archivo real. */
export const SAMPLE_ROWS: Cell[][] = [
  // Código numérico y precio con la basura de coma flotante que Excel guarda de verdad.
  [100528, 14, "Manilla balconera de placa larga", "pz", "pz", 1, 11.379999999999999, null, null],
  // Clave alterna vacía: la celda vacía va seguida de una con contenido, que es el caso que
  // hacía que un lector ingenuo atribuyera la descripción a la columna equivocada.
  [100529, null, "Compás abatible para tirafondo 204 plata", "pz", "pz", 1, 15.94, null, null],
  // Código de TEXTO con ceros iniciales: si pasara por un entero quedaría "12".
  ["0012", 16, "Tornillo cabeza avellanada m4x8", "pz", "caja", 50, 0.15000000000000002, null, null],
  // Código alfanumérico, como el X11092 del archivo real.
  ["X11092", 630, "Tapa embellecedora", "pz", "pz", 1, 0.11, null, null],
  // Precio entero y precio de un decimal.
  [235613, null, "Cerradero picaporte Tricoat-Evo", "pz", "pz", 1, 19, null, null],
  [235650, 626, "Prolongador frontal para balconera", "pz", "pz", 1, 12.05, null, null],
];
