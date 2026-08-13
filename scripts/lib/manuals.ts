// Inspección de la carpeta de manuales técnicos de herrajes MACO.
//
// A la fecha de este importador la carpeta existe y está VACÍA. Eso no es un error ni algo que
// haya que rellenar: es el estado real de la documentación técnica, y el importador lo reporta
// como "0 manuales MACO encontrados" y sigue con los precios.
//
// La razón por la que esta pieza existe estando vacía la carpeta es la tabla de mapeos
// (supplier_hardware_mappings): sin manual no hay forma legítima de saber qué herraje lleva una
// corredera de 60mm de dos hojas, y por tanto no hay lista de materiales. Los manuales son la
// única fuente admisible para llenarla, así que su ingesta queda lista para el día que lleguen.
//
// Lo que NO hace, a propósito: no usa la carpeta general de MANUALES de Aluplast como sustituto
// (son manuales de perfiles, no de herrajes), no copia archivos al repositorio, y no deduce
// relaciones técnicas de nombres de archivo.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/** Extensiones cuyo texto se puede extraer hoy sin dependencias nuevas. */
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".xml"]);

const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "application/xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export type ManualFile = {
  name: string;
  /** Ruta absoluta en la máquina. El archivo se queda donde está: no se copia al repositorio. */
  location: string;
  mimeType: string;
  fileHash: string;
  fileSize: number;
  /** "extraido" cuando el texto se pudo leer, "pendiente" cuando hace falta un extractor. */
  extractionStatus: "extraido" | "pendiente";
  extractedText: string;
  extractedLocation: string;
};

/** Recorre la carpeta de forma recursiva, incluyendo archivos y carpetas ocultos. */
function walk(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

/**
 * Inspecciona la carpeta y devuelve los manuales encontrados con su hash y metadatos.
 *
 * Devuelve lista vacía cuando la carpeta no existe o está vacía. No lanza: la ausencia de
 * manuales no debe impedir importar precios.
 */
export function scanManuals(directory: string): ManualFile[] {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];

  return walk(directory).map((location) => {
    const bytes = readFileSync(location);
    const extension = extname(location).toLowerCase();
    const canExtract = TEXT_EXTENSIONS.has(extension);
    return {
      name: location.slice(directory.length).replace(/^[\\/]+/, ""),
      location,
      mimeType: MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
      fileHash: createHash("sha256").update(bytes).digest("hex"),
      fileSize: bytes.length,
      // Un PDF queda "pendiente" y no "extraido" vacío: la diferencia entre "no tiene texto" y
      // "no lo sabemos leer todavía" importa para saber si falta trabajo o falta el documento.
      extractionStatus: canExtract ? "extraido" : "pendiente",
      extractedText: canExtract ? bytes.toString("utf8") : "",
      extractedLocation: canExtract ? "archivo completo" : "",
    };
  });
}
