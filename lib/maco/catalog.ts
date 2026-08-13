// Consulta del catálogo de herrajes MACO para sistemas Aluplast.
//
// SOLO SERVIDOR. Los precios de esta lista son información interna del proveedor: no salen al
// cotizador público, no viajan en ningún payload público y no deben quedar incrustados en el HTML
// que se sirve a un cliente. Este módulo se importa desde una route handler protegida
// (app/api/maco-hardware/route.ts) y nada más; la pantalla interna pide los datos por fetch y
// recibe solo la página que pidió.
//
// Frontera con lo público: lib/publicCatalog.ts es la única superficie que el cotizador público
// consume, y NO importa este archivo. Esa separación es la que hay que conservar -- hay una prueba
// que lo verifica leyendo los imports (tests/macoCatalog.test.ts).
//
// Nunca carga el catálogo completo: toda consulta lleva límite y desplazamiento, y el límite tiene
// techo (MAX_LIMIT). 637 artículos caben en memoria hoy, pero una lista de proveedor crece y una
// pantalla de búsqueda no necesita más de una página.

import { and, desc, eq, like, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { supplierCatalogSources, supplierHardwareItems, supplierHardwarePrices } from "@/db/schema";
import type { MacoHardwareRow, MacoSearchField } from "@/types/maco";
import { BRAND, SUPPLIER } from "./priceList";

type Db = DrizzleD1Database<Record<string, unknown>>;

/** Techo de resultados por consulta. Una búsqueda que necesite más está mal planteada. */
export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 25;

/** Campos por los que se puede buscar. Definido en types/maco.ts, que no importa nada. */
export type SearchField = MacoSearchField;

export function isSearchField(value: string): value is SearchField {
  return value === "sku" || value === "clave" || value === "descripcion" || value === "todo";
}

/** Una revisión de la lista, con su estado y cuántos artículos trae. */
export type HardwareRevision = {
  id: string;
  supplier: string;
  brand: string;
  revision: string;
  effectiveDate: string;
  currency: string;
  terms: string;
  /** `true` cuando es la lista con la que se cotiza. ABR_22 es `false`. */
  active: boolean;
  /** `true` cuando es una lista histórica conservada para trazabilidad. */
  historical: boolean;
  fileName: string;
  /** Primeros 12 caracteres del SHA-256: suficiente para reconocer el archivo en pantalla. */
  fileHashShort: string;
  importedAt: string;
  itemCount: number;
};

/** Un artículo con su precio en la revisión consultada. Definido en types/maco.ts. */
export type HardwareRow = MacoHardwareRow;

export type SearchResult = {
  rows: HardwareRow[];
  /** Total de coincidencias, para poder paginar sin traerlas todas. */
  total: number;
  limit: number;
  offset: number;
};

/** Escapa los comodines de LIKE para que un `%` escrito por el usuario se busque literal. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || limit === undefined || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(limit), MAX_LIMIT);
}

/**
 * Revisiones importadas de la lista de herrajes, la más reciente primero. Es lo que permite a la
 * pantalla interna decir si lo que se está viendo es la lista vigente o una histórica.
 */
export async function listHardwareRevisions(db: Db): Promise<HardwareRevision[]> {
  const rows = await db
    .select({
      id: supplierCatalogSources.id,
      supplier: supplierCatalogSources.supplier,
      brand: supplierCatalogSources.brand,
      revision: supplierCatalogSources.revision,
      effectiveDate: supplierCatalogSources.effectiveDate,
      currency: supplierCatalogSources.currency,
      terms: supplierCatalogSources.terms,
      active: supplierCatalogSources.active,
      historical: supplierCatalogSources.historical,
      fileName: supplierCatalogSources.fileName,
      fileHash: supplierCatalogSources.fileHash,
      importedAt: supplierCatalogSources.importedAt,
    })
    .from(supplierCatalogSources)
    .where(eq(supplierCatalogSources.supplier, SUPPLIER))
    .orderBy(desc(supplierCatalogSources.effectiveDate));

  // Los artículos por revisión se cuentan con un GROUP BY aparte y no con una subconsulta
  // correlacionada dentro del `select`: esa versión devolvía 0 en todas las filas porque la
  // referencia a la tabla externa no queda correlacionada al renderizarse. Son dos consultas
  // triviales sobre un puñado de revisiones, y el resultado es verificable.
  const counts = await db
    .select({ sourceId: supplierHardwarePrices.sourceId, total: sql<number>`COUNT(*)` })
    .from(supplierHardwarePrices)
    .groupBy(supplierHardwarePrices.sourceId);
  const countBySource = new Map(counts.map((row) => [row.sourceId, Number(row.total ?? 0)]));

  return rows.map((row) => ({
    id: row.id,
    supplier: row.supplier,
    brand: row.brand,
    revision: row.revision,
    effectiveDate: row.effectiveDate,
    currency: row.currency,
    terms: row.terms,
    active: row.active === 1,
    historical: row.historical === 1,
    fileName: row.fileName,
    // Solo el prefijo del hash sale de aquí: alcanza para reconocer el archivo en pantalla, y el
    // hash completo no tiene por qué viajar al navegador.
    fileHashShort: row.fileHash.slice(0, 12),
    importedAt: row.importedAt,
    itemCount: countBySource.get(row.id) ?? 0,
  }));
}

export type SearchOptions = {
  /** Texto a buscar. Vacío lista la revisión completa, paginada. */
  q?: string;
  field?: SearchField;
  /** Etiqueta de revisión ("ABR_22"). Sin ella se usa la revisión más reciente importada. */
  revision?: string;
  limit?: number;
  offset?: number;
};

/**
 * Busca herrajes por SKU, clave alterna o descripción dentro de una revisión.
 *
 * El precio se toma de la revisión consultada, no del artículo: por eso hay un `innerJoin` contra
 * los precios de ESA fuente. Es lo que hace que consultar ABR_22 devuelva el precio de 2022
 * aunque más adelante se importe una lista nueva.
 */
export async function searchHardware(db: Db, options: SearchOptions = {}): Promise<SearchResult> {
  const limit = clampLimit(options.limit);
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const term = (options.q ?? "").trim();
  const field = options.field ?? "todo";

  const revisions = await listHardwareRevisions(db);
  const target = options.revision
    ? revisions.find((revision) => revision.revision === options.revision)
    : revisions[0];

  if (!target) return { rows: [], total: 0, limit, offset };

  const pattern = `%${escapeLike(term)}%`;
  const textFilter = term === ""
    ? undefined
    : field === "sku"
      ? like(supplierHardwareItems.sku, pattern)
      : field === "clave"
        ? like(supplierHardwareItems.altKey, pattern)
        : field === "descripcion"
          ? like(supplierHardwareItems.description, pattern)
          : or(
              like(supplierHardwareItems.sku, pattern),
              like(supplierHardwareItems.altKey, pattern),
              like(supplierHardwareItems.description, pattern)
            );

  const where = textFilter
    ? and(eq(supplierHardwarePrices.sourceId, target.id), textFilter)
    : eq(supplierHardwarePrices.sourceId, target.id);

  const counted = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(supplierHardwarePrices)
    .innerJoin(supplierHardwareItems, eq(supplierHardwareItems.id, supplierHardwarePrices.itemId))
    .where(where);

  const rows = await db
    .select({
      sku: supplierHardwareItems.sku,
      altKey: supplierHardwareItems.altKey,
      description: supplierHardwareItems.description,
      unit: supplierHardwareItems.unit,
      presentation: supplierHardwareItems.presentation,
      qtyPerPresentation: supplierHardwareItems.qtyPerPresentation,
      unitPrice: supplierHardwarePrices.unitPrice,
      currency: supplierHardwarePrices.currency,
      effectiveDate: supplierHardwarePrices.effectiveDate,
      terms: supplierHardwarePrices.terms,
      sourceRow: supplierHardwarePrices.sourceRow,
      supplier: supplierHardwareItems.supplier,
      brand: supplierHardwareItems.brand,
    })
    .from(supplierHardwarePrices)
    .innerJoin(supplierHardwareItems, eq(supplierHardwareItems.id, supplierHardwarePrices.itemId))
    .where(where)
    // Por SKU y no por relevancia: es un catálogo de proveedor y el operador busca un código
    // concreto, así que un orden estable y predecible vale más que un ranking.
    .orderBy(supplierHardwareItems.sku)
    .limit(limit)
    .offset(offset);

  return {
    rows: rows.map((row) => ({
      ...row,
      revision: target.revision,
      revisionActive: target.active,
      revisionHistorical: target.historical,
    })),
    total: Number(counted[0]?.total ?? 0),
    limit,
    offset,
  };
}

/** Encabezado de la pantalla interna. Constante para que la etiqueta no se reescriba en la UI. */
export const CATALOG_TITLE = `Herrajes ${SUPPLIER} para sistemas ${BRAND}`;

/** Etiqueta de una revisión: "Lista histórica ABR_22 · 1 de mayo de 2022 · EUR · EXWORK …". */
export function revisionLabel(revision: HardwareRevision): string {
  const [year, month, day] = revision.effectiveDate.split("-");
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const readableDate = year && month && day
    ? `${Number(day)} de ${months[Number(month) - 1] ?? month} de ${year}`
    : revision.effectiveDate;
  const state = revision.active ? "Lista vigente" : revision.historical ? "Lista histórica" : "Lista";
  return `${state} ${revision.revision} · ${readableDate} · ${revision.currency} · ${revision.terms}`;
}
