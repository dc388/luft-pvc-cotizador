import { checkBurst, clientIp, tooManyRequests } from "@/lib/rateLimit";
import { checkConfig, checkConfigs, PublicQuoteError } from "@/lib/publicQuote";

// Disponibilidad de una configuración del cotizador público (app/cotizar).
//
// ESTA RUTA NO DEVUELVE DINERO. Antes respondía con el precio comercial y el navegador lo
// pintaba en cada tarjeta, en el pie y en el resumen. Ahora ejecuta el mismo motor (lib/calc.ts
// vía priceConfig) para comprobar que la configuración se puede fabricar y cotizar, y responde
// solo con eso: disponible o no, y por qué no. El importe se calcula, se valida contra la
// política comercial y se descarta en el servidor.
//
// El precio del proyecto se calcula una sola vez, al registrarlo (/api/public-quote/submit), y
// aparece únicamente dentro del documento definitivo (/cotizacion/<token>).
//
// Anti-abuso: freno de ráfaga en memoria, no el límite exacto en D1 que usa /submit. El wizard
// llama a esta ruta en cada cambio de configuración, así que registrar cada llamada en la base
// de datos costaría más de lo que ahorraría. Ver lib/rateLimit.ts.
export async function POST(request: Request) {
  if (!checkBurst(clientIp(request))) return tooManyRequests(60);

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (Array.isArray(body.items)) {
      return Response.json({ items: checkConfigs(body.items) });
    }
    const availability = checkConfig(body);
    if (!availability.available) return Response.json({ error: availability.reason }, { status: 400 });
    return Response.json({ available: true });
  } catch (error) {
    if (error instanceof PublicQuoteError) return Response.json({ error: error.message }, { status: 400 });
    // Un error inesperado no debe filtrarle detalles técnicos a un cliente final.
    console.error("public-quote", error);
    return Response.json({ error: "No pudimos revisar tu configuración en este momento. Intenta de nuevo." }, { status: 500 });
  }
}
