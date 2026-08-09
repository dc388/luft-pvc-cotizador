import { checkBurst, clientIp, tooManyRequests } from "@/lib/rateLimit";
import { parseConfig, priceConfig, PublicQuoteError } from "@/lib/publicQuote";

// Precio en vivo del cotizador público (app/cotizar). Recalcula con el mismo motor que la app
// interna y responde SOLO con el precio comercial -- ningún costo, margen ni detalle de
// fabricación cruza al navegador. No toca la base de datos: cotizar no guarda nada.
//
// Anti-abuso: freno de ráfaga en memoria, no el límite exacto en D1 que usa /submit. El wizard
// llama a esta ruta en cada cambio de configuración, así que registrar cada llamada en la base
// de datos costaría más de lo que ahorraría. Ver lib/rateLimit.ts.
export async function POST(request: Request) {
  if (!checkBurst(clientIp(request))) return tooManyRequests(60);

  try {
    const config = parseConfig(await request.json().catch(() => ({})));
    return Response.json({ price: priceConfig(config) });
  } catch (error) {
    if (error instanceof PublicQuoteError) return Response.json({ error: error.message }, { status: 400 });
    // Un error inesperado no debe filtrarle detalles técnicos a un cliente final.
    console.error("public-quote", error);
    return Response.json({ error: "No pudimos calcular el precio en este momento. Intenta de nuevo." }, { status: 500 });
  }
}
