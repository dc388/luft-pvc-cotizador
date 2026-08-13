// Resolución de accesos directos de Windows (.lnk).
//
// Hace falta porque la ruta que se recibe de un archivo abierto recientemente en Office es un
// .lnk, no el libro: `%APPDATA%\Microsoft\Office\Recent\...\LOUDVENTURES_MEXpricelist22_2022_MACO.LNK`.
// Un .lnk son unos cientos de bytes de metadatos de Shell -- si se importaran esos bytes como si
// fueran el .xlsx, el lector fallaría con "no es un zip" y no quedaría claro por qué.
//
// Dos caminos, en este orden:
//   1. WScript.Shell vía PowerShell. Es quien resuelve de verdad: entiende rutas relativas,
//      variables de entorno y objetivos de red, que es justo el caso aquí (el archivo vive en un
//      atajo de Google Drive, G:\.shortcut-targets-by-id\...).
//   2. Lectura directa de los bytes, buscando la ruta absoluta que el .lnk guarda en texto. Es la
//      red de seguridad para cuando no hay PowerShell disponible.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

/** `true` si la ruta apunta a un acceso directo de Windows. */
export function isShortcut(filePath: string): boolean {
  return /\.lnk$/i.test(filePath);
}

function resolveWithShell(filePath: string): string {
  // -Command con un script de una línea: no se pasa nada del usuario por una shell, la ruta va
  // como literal entre comillas simples y se duplican las comillas simples que traiga.
  const literal = filePath.replace(/'/g, "''");
  const script = `$ErrorActionPreference='Stop';(New-Object -ComObject WScript.Shell).CreateShortcut('${literal}').TargetPath`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

/**
 * Busca en los bytes del .lnk la ruta absoluta del objetivo. El formato guarda la ruta como
 * cadena ANSI y a veces también UTF-16LE; se toma la más larga que apunte a un archivo con
 * extensión, porque el .lnk también contiene rutas parciales de cada carpeta del camino.
 */
function resolveFromBytes(filePath: string, extensions: readonly string[]): string {
  const buffer = readFileSync(filePath);
  const candidates: string[] = [];
  const pattern = new RegExp(String.raw`[A-Za-z]:\\[^\x00]*?\.(?:${extensions.join("|")})`, "gi");

  for (const text of [buffer.toString("latin1"), buffer.toString("utf16le")]) {
    for (const match of text.matchAll(pattern)) candidates.push(match[0]);
  }
  // La ruta completa es la más larga: las cortas son fragmentos de carpetas intermedias.
  candidates.sort((a, b) => b.length - a.length);
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0] ?? "";
}

/**
 * Devuelve la ruta real del archivo. Si `filePath` no es un .lnk lo devuelve tal cual; si lo es,
 * resuelve su objetivo y verifica que exista.
 *
 * `extensions` son las extensiones esperadas del objetivo; sirven tanto para la búsqueda por
 * bytes como para detectar un acceso directo que apunte a otra cosa.
 */
export function resolveShortcut(filePath: string, extensions: readonly string[] = ["xlsx"]): string {
  if (!isShortcut(filePath)) return filePath;
  if (!existsSync(filePath)) throw new Error(`No existe el acceso directo: ${filePath}`);

  const target = resolveWithShell(filePath) || resolveFromBytes(filePath, extensions);
  if (!target) {
    throw new Error(`No se pudo resolver el destino del acceso directo: ${filePath}`);
  }
  if (!existsSync(target)) {
    throw new Error(
      `El acceso directo apunta a un archivo que no está disponible:\n  ${target}\n` +
        "Si vive en Google Drive u otra unidad de red, monta la unidad y vuelve a intentarlo."
    );
  }
  if (!extensions.some((extension) => target.toLowerCase().endsWith(`.${extension.toLowerCase()}`))) {
    throw new Error(`El acceso directo no apunta a un archivo ${extensions.join("/")}: ${target}`);
  }
  return target;
}
