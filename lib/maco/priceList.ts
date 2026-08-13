// Interpretación de la lista de precios de herrajes MACO para sistemas Aluplast.
//
// Módulo puro: recibe filas ya leídas y no toca disco, red ni base de datos. Es lo que permite
// probar la interpretación con fixtures sintéticos, sin el Excel real -- que trae datos privados
// de un cliente y por eso no entra al repositorio.
//
// Reglas que este archivo defiende, todas del contrato de la lista:
//
//   - Solo la hoja "precio". La hoja "orden" del mismo libro contiene RFC, domicilio, contactos y
//     datos bancarios de un cliente: no se lee, no se registra y no aparece en ningún mensaje.
//     Aquí eso se expresa como una lista de hojas prohibidas que se verifica explícitamente.
//   - El SKU es texto. Ver `normalizeSku`.
//   - El precio se conserva exacto. Ver lib/maco/decimal.ts.
//   - No se infiere nada. Las columnas "alerta" y "comprobar" son campos auxiliares del archivo
//     y NO reglas comerciales, así que se leen para reportar y nunca deciden nada. Tampoco se
//     deduce sistema, apertura, cantidad ni posición de montaje de las palabras de la
//     descripción: la lista es de artículos y precios, no una lista de materiales.

import { canonicalDecimal, type ExactDecimal } from "./decimal";

/** La única hoja que este importador lee. */
export const SHEET_PRECIO = "precio";

/**
 * Hojas que NO se leen jamás. "orden" trae información comercial privada de un cliente
 * (RFC, domicilio, contactos, datos bancarios y cantidades de un pedido concreto).
 */
export const FORBIDDEN_SHEETS = ["orden"] as const;

export const SUPPLIER = "MACO";
export const BRAND = "Aluplast";
export const CURRENCY = "EUR";
export const TERMS = "EXWORK Veracruz/México";

/** Estructura mínima de una celda leída. La cumple `SheetCell` de scripts/lib/xlsx.ts. */
export type SourceCell = { raw: string; numeric: boolean };
/** Estructura mínima de una fila leída, indexada por columna 1-based. */
export type SourceRow = { number: number; cells: Map<number, SourceCell> };

/** Encabezados que la hoja debe traer para que la interpretación sea fiable. */
const REQUIRED_HEADERS = ["codigo", "descripcion", "precio un"] as const;

/** Encabezado normalizado -> campo. Las claves ya vienen sin acentos ni puntos finales. */
const HEADER_FIELDS: Record<string, keyof ColumnMap> = {
  "codigo": "sku",
  "clave alterna": "altKey",
  "descripcion": "description",
  "unidad": "unit",
  "pres": "presentation",
  "cant/pres": "qtyPerPresentation",
  "precio un": "unitPrice",
  "precio unitario": "unitPrice",
  "alerta": "alert",
  "comprobar": "check",
};

export type ColumnMap = {
  sku: number;
  altKey: number;
  description: number;
  unit: number;
  presentation: number;
  qtyPerPresentation: number;
  unitPrice: number;
  alert: number;
  check: number;
};

/**
 * Normaliza texto de forma conservadora: unifica la forma Unicode, quita caracteres invisibles y
 * colapsa espacios. NO cambia mayúsculas, acentos, puntuación ni palabras -- la descripción del
 * proveedor se conserva tal cual porque es lo que identifica la pieza en su propio catálogo.
 */
export function normalizeText(raw: string): string {
  return raw
    .normalize("NFC")
    // Espacio duro, espacios tipográficos y marcas de ancho cero: se ven como espacio (o como
    // nada) pero rompen cualquier comparación o búsqueda por texto.
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normaliza un encabezado para compararlo: minúsculas, sin acentos, sin punto final. */
function normalizeHeader(raw: string): string {
  return normalizeText(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.+$/, "")
    .trim();
}

/**
 * Normaliza un código de proveedor (SKU o clave alterna) conservándolo como TEXTO.
 *
 * Una celda numérica del libro llega como "100528.0" (así lo escribe la hoja de cálculo), y ese
 * `.0` es un artefacto del formato, no parte del código: se quita. Una celda de texto NO se toca
 * más allá de los espacios, y ahí está la razón de todo esto -- un SKU como "0012" pierde los
 * ceros iniciales en cuanto pasa por un entero, y entonces deja de ser el código impreso en la
 * caja del proveedor. El mismo archivo mezcla códigos numéricos con códigos como "X11092", así
 * que un entero tampoco serviría como tipo de columna.
 *
 * Se aplica igual a la clave alterna: el archivo real trae "101408.0" en esa columna, y mostrarlo
 * así en pantalla sería mostrar un código que el proveedor no usa.
 */
export function normalizeSku(cell: SourceCell): string {
  const text = normalizeText(cell.raw);
  if (!cell.numeric) return text;
  const exact = canonicalDecimal(text);
  return exact ? exact.text : text;
}

/** Igual que `normalizeSku`, para una celda que puede no existir. */
function normalizeCode(cell: SourceCell | undefined): string {
  return cell ? normalizeSku(cell) : "";
}

/** Normaliza una cantidad numérica a su forma canónica en texto: "1.0" -> "1". */
export function normalizeQuantity(cell: SourceCell | undefined): string {
  if (!cell) return "";
  const text = normalizeText(cell.raw);
  if (!cell.numeric) return text;
  const exact = canonicalDecimal(text);
  return exact ? exact.text : text;
}

/**
 * Encuentra la fila de encabezados. No se asume que sea la fila 5: el archivo trae título y
 * metadatos arriba, y una revisión posterior puede agregar o quitar renglones de portada. Se
 * busca la primera fila que traiga todos los encabezados obligatorios.
 */
export function findHeaderRow(rows: SourceRow[], searchLimit = 50): { row: SourceRow; columns: ColumnMap } | null {
  for (const row of rows) {
    if (row.number > searchLimit) break;

    const found: Partial<ColumnMap> = {};
    const seen = new Set<string>();
    for (const [column, cell] of row.cells) {
      const header = normalizeHeader(cell.raw);
      seen.add(header);
      const field = HEADER_FIELDS[header];
      // El primer encabezado gana: si un libro repitiera una columna, se usa la de la izquierda.
      if (field && found[field] === undefined) found[field] = column;
    }
    if (!REQUIRED_HEADERS.every((header) => seen.has(header))) continue;

    return {
      row,
      columns: {
        sku: found.sku ?? 0,
        altKey: found.altKey ?? 0,
        description: found.description ?? 0,
        unit: found.unit ?? 0,
        presentation: found.presentation ?? 0,
        qtyPerPresentation: found.qtyPerPresentation ?? 0,
        unitPrice: found.unitPrice ?? 0,
        alert: found.alert ?? 0,
        check: found.check ?? 0,
      },
    };
  }
  return null;
}

export type ListMetadata = {
  /** Etiqueta de revisión declarada por el archivo: "ABR_22". */
  revision: string;
  /** Fecha efectiva en ISO corto: "2022-05-01". */
  effectiveDate: string;
};

const REVISION_LINE = /revisi[oó]n\s+([A-Za-z]{3,}_\d{2,4})\s*\((\d{1,2})\/(\d{1,2})\/(\d{4})\)/i;

/**
 * Lee revisión y fecha efectiva de los renglones de portada, ANTES del encabezado. No se dan por
 * sabidas: si el archivo no las declara, el importador se detiene en vez de etiquetar precios con
 * una revisión inventada -- una lista mal fechada es peor que ninguna lista.
 *
 * La fecha del archivo viene como (01/05/2022), en día/mes/año.
 */
export function parseListMetadata(rows: SourceRow[], headerRowNumber: number): ListMetadata | null {
  for (const row of rows) {
    if (row.number >= headerRowNumber) break;
    for (const cell of row.cells.values()) {
      const match = REVISION_LINE.exec(normalizeText(cell.raw));
      if (!match) continue;
      const [, revision, day, month, year] = match;
      return {
        revision: revision.toUpperCase(),
        effectiveDate: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
      };
    }
  }
  return null;
}

export type ParsedItem = {
  sku: string;
  altKey: string;
  description: string;
  unit: string;
  presentation: string;
  qtyPerPresentation: string;
  /** Precio unitario exacto de la revisión, en la moneda de la lista. */
  price: ExactDecimal;
  /** Fila del Excel de la que salió, para trazabilidad. */
  sourceRow: number;
};

/** Fila que no se pudo aceptar, con el motivo. Nunca incluye el valor de una celda de "orden". */
export type RejectedRow = { row: number; reason: string };

/** Mismo SKU dos veces en la misma revisión con el MISMO precio. Se conserva la primera. */
export type DuplicateRow = { row: number; sku: string; firstRow: number };

/** Mismo SKU dos veces en la misma revisión con precios DISTINTOS. Detiene la importación. */
export type PriceConflict = { sku: string; firstRow: number; firstPrice: string; row: number; price: string };

export type ParseStats = {
  /** Filas de datos miradas: desde la siguiente al encabezado hasta la última con contenido. */
  examined: number;
  /** Filas aceptadas como artículo. */
  valid: number;
  /** Filas vacías, omitidas sin ruido. */
  skipped: number;
  /** Filas con contenido pero inservibles (sin SKU, sin descripción o sin precio válido). */
  rejected: number;
  /** Repeticiones de SKU con precio idéntico. */
  duplicates: number;
  /** SKU distintos aceptados. */
  uniqueSkus: number;
};

export type ParseResult = {
  metadata: ListMetadata;
  columns: ColumnMap;
  headerRow: number;
  items: ParsedItem[];
  rejected: RejectedRow[];
  duplicates: DuplicateRow[];
  conflicts: PriceConflict[];
  stats: ParseStats;
};

function cellText(row: SourceRow, column: number): string {
  if (column <= 0) return "";
  const cell = row.cells.get(column);
  return cell ? normalizeText(cell.raw) : "";
}

/**
 * Verifica que el nombre de hoja pedido sea el permitido. Se llama antes de descomprimir nada:
 * es la barrera que impide que un cambio futuro haga que el importador recorra todo el libro.
 */
export function assertSheetAllowed(name: string): void {
  const normalized = name.trim().toLowerCase();
  if (FORBIDDEN_SHEETS.some((forbidden) => forbidden === normalized)) {
    throw new Error(
      `La hoja "${name}" contiene información comercial privada y no puede importarse. Solo se lee "${SHEET_PRECIO}".`
    );
  }
  if (normalized !== SHEET_PRECIO) {
    throw new Error(`Este importador solo lee la hoja "${SHEET_PRECIO}"; se pidió "${name}".`);
  }
}

/**
 * Interpreta la hoja "precio" completa.
 *
 * No decide cuántos artículos "debería" haber: recorre lo que hay después del encabezado, cuenta
 * lo que acepta y lo que descarta, y reporta ambas cosas. Las filas de relleno que la hoja de
 * cálculo deja al final (hasta la 1000 en el archivo real) no cuentan como examinadas porque no
 * contienen nada: se corta en la última fila con contenido.
 */
export function parsePriceList(rows: SourceRow[]): ParseResult {
  const header = findHeaderRow(rows);
  if (!header) {
    throw new Error(
      `La hoja "${SHEET_PRECIO}" no tiene una fila de encabezados reconocible (se esperaban: ${REQUIRED_HEADERS.join(", ")}).`
    );
  }
  const metadata = parseListMetadata(rows, header.row.number);
  if (!metadata) {
    throw new Error(`La hoja "${SHEET_PRECIO}" no declara revisión ni fecha efectiva; no se importa sin ellas.`);
  }

  const { columns } = header;
  const dataRows = rows.filter((row) => row.number > header.row.number);
  // Última fila con contenido real: lo de más abajo es relleno de la hoja de cálculo.
  let lastWithContent = 0;
  for (const row of dataRows) {
    for (const cell of row.cells.values()) {
      if (normalizeText(cell.raw) !== "") {
        lastWithContent = row.number;
        break;
      }
    }
  }

  const items: ParsedItem[] = [];
  const rejected: RejectedRow[] = [];
  const duplicates: DuplicateRow[] = [];
  const conflicts: PriceConflict[] = [];
  const bySku = new Map<string, ParsedItem>();
  let examined = 0;
  let skipped = 0;

  for (const row of dataRows) {
    if (row.number > lastWithContent) break;
    examined++;

    const skuCell = columns.sku > 0 ? row.cells.get(columns.sku) : undefined;
    const sku = skuCell ? normalizeSku(skuCell) : "";
    const description = cellText(row, columns.description);
    const priceRaw = cellText(row, columns.unitPrice);

    if (sku === "" && description === "" && priceRaw === "") {
      skipped++;
      continue;
    }
    if (sku === "") {
      rejected.push({ row: row.number, reason: "sin código" });
      continue;
    }
    if (description === "") {
      rejected.push({ row: row.number, reason: "sin descripción" });
      continue;
    }
    if (priceRaw === "") {
      rejected.push({ row: row.number, reason: "sin precio" });
      continue;
    }
    const price = canonicalDecimal(priceRaw);
    if (!price) {
      rejected.push({ row: row.number, reason: "precio no interpretable" });
      continue;
    }
    if (price.minor < 0) {
      rejected.push({ row: row.number, reason: "precio negativo" });
      continue;
    }

    const item: ParsedItem = {
      sku,
      altKey: normalizeCode(columns.altKey > 0 ? row.cells.get(columns.altKey) : undefined),
      description,
      unit: cellText(row, columns.unit),
      presentation: cellText(row, columns.presentation),
      qtyPerPresentation: normalizeQuantity(columns.qtyPerPresentation > 0 ? row.cells.get(columns.qtyPerPresentation) : undefined),
      price,
      sourceRow: row.number,
    };

    const previous = bySku.get(sku);
    if (previous) {
      if (previous.price.text === price.text) {
        duplicates.push({ row: row.number, sku, firstRow: previous.sourceRow });
      } else {
        conflicts.push({
          sku,
          firstRow: previous.sourceRow,
          firstPrice: previous.price.text,
          row: row.number,
          price: price.text,
        });
      }
      continue;
    }
    bySku.set(sku, item);
    items.push(item);
  }

  return {
    metadata,
    columns,
    headerRow: header.row.number,
    items,
    rejected,
    duplicates,
    conflicts,
    stats: {
      examined,
      valid: items.length,
      skipped,
      rejected: rejected.length,
      duplicates: duplicates.length,
      uniqueSkus: bySku.size,
    },
  };
}
