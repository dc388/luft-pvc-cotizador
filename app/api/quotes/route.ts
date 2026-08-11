import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { listQuotes } from "@/lib/quoteRepo";
import { isQuoteStatus } from "@/lib/quoteStatus";

// La libreta de clientes del panel interno.
//
// NO lleva el prefijo `public-` a propósito: devuelve nombre, teléfono, correo, dirección e
// importes de cada cliente, así que queda detrás de la contraseña interna por omisión (ver la
// decisión de lista blanca en lib/internalGate.ts). Es la única razón por la que puede devolver
// `total`: nadie llega aquí sin haber pasado por /acceso.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "";
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const rows = await listQuotes(getDb(), {
      q: (url.searchParams.get("q") ?? "").slice(0, 120),
      status: isQuoteStatus(status) ? status : undefined,
      from: ISO_DAY.test(from) ? from : undefined,
      to: ISO_DAY.test(to) ? to : undefined,
    });
    return Response.json({ quotes: rows });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
