import { money } from "@/lib/money";

// Estado de precio de cara al cliente. Existe para separar dos cosas que la interfaz venía
// mezclando: "¿ya hay un precio?" (esto) y "¿de dónde salieron las tarifas del sistema?"
// (`sourced` en data/catalog.ts). Etiquetar una tarjeta del selector como "Precio estimado"
// cuando todavía no se ha calculado nada anunciaba un estado de precio donde no había precio.
//
// El precio SIEMPRE viene del motor real (lib/calc.ts vía /api/public-quote). Aquí no se
// calcula, no se cachea y no se rellena: cuando faltan datos se piden, y cuando el cálculo
// falla se dice que falló. Nunca se sustituye un fallo por una cifra aproximada.
export type PriceStatus =
  | { kind: "missing-data" }
  | { kind: "calculating" }
  | { kind: "available"; total: number }
  /** `reason` permite decir *por qué* no hay precio cuando se sabe (p. ej. la medida excede el
   *  máximo fabricable de ese estilo), en vez de un "No disponible" sin explicación. */
  | { kind: "error"; reason?: string };

export const PRICE_CTA = "Calcular precio";

export function priceStatusLabel(status: PriceStatus): string {
  switch (status.kind) {
    case "missing-data":
      return PRICE_CTA;
    case "calculating":
      return "Calculando…";
    case "available":
      return money(status.total);
    case "error":
      return status.reason ?? "No disponible";
  }
}

/** Validación de medida idéntica a la del servidor (lib/publicQuote.ts parseConfig), usada para
 *  no mandar al motor configuraciones que ya se sabe que va a rechazar. El servidor sigue siendo
 *  la autoridad: esto solo evita que un estilo inválido tumbe el lote de los demás. */
export function sizeRejection(
  style: { maxW: number; maxH: number; panels: number },
  widthMm: number,
  heightMm: number,
  minMm: number
): string | null {
  if (widthMm < minMm || heightMm < minMm) return `Mínimo ${minMm} mm por lado`;
  if (widthMm > style.maxW || heightMm > style.maxH) return `Hasta ${style.maxW.toLocaleString("es-MX")} × ${style.maxH.toLocaleString("es-MX")} mm`;
  if (widthMm / style.panels < minMm) return `Con ${style.panels} hojas el ancho mínimo es ${(minMm * style.panels).toLocaleString("es-MX")} mm`;
  return null;
}
