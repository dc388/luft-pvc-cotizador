import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import {
  CATALOG_TITLE,
  MAX_LIMIT,
  isSearchField,
  listHardwareRevisions,
  revisionLabel,
  searchHardware,
} from "@/lib/maco/catalog";

// Catálogo de herrajes MACO para sistemas Aluplast, para el área interna.
//
// NO lleva el prefijo `public-` a propósito, y eso es lo que la protege: la lista blanca de
// lib/internalGate.ts solo deja pasar `/api/public-*`, así que esta ruta queda detrás de la
// contraseña interna por omisión. Es la misma decisión que en /api/quotes.
//
// Devuelve precios de proveedor, que son información interna: por eso vive aquí y no en el
// cotizador público. La consulta corre en el servidor y solo baja la página pedida -- el catálogo
// completo nunca se serializa hacia el navegador.

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const db = getDb();

    const revisions = await listHardwareRevisions(db);
    const field = url.searchParams.get("campo") ?? "";
    const requestedLimit = Number(url.searchParams.get("limite") ?? "");
    const requestedOffset = Number(url.searchParams.get("desde") ?? "");

    const result = await searchHardware(db, {
      // El texto se recorta antes de llegar a la consulta: un término de 10 kB no busca mejor.
      q: (url.searchParams.get("q") ?? "").slice(0, 120),
      field: isSearchField(field) ? field : "todo",
      revision: (url.searchParams.get("revision") ?? "").slice(0, 40) || undefined,
      limit: Number.isFinite(requestedLimit) ? requestedLimit : undefined,
      offset: Number.isFinite(requestedOffset) ? requestedOffset : undefined,
    });

    return Response.json({
      title: CATALOG_TITLE,
      maxLimit: MAX_LIMIT,
      revisions: revisions.map((revision) => ({ ...revision, label: revisionLabel(revision) })),
      ...result,
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
