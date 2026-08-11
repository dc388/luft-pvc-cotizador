// Disponibilidad de una configuración de cara al cliente.
//
// Este archivo era el estado de PRECIO de una tarjeta: preguntaba "¿ya hay un precio?" y su
// respuesta feliz era una cifra. Ya no: el cliente no ve importes mientras configura, así que la
// única pregunta que queda es si esa opción se puede fabricar con la medida que dio.
//
// El servidor sigue corriendo el motor real (lib/calc.ts vía /api/public-quote) para contestarlo:
// una opción se ofrece como disponible solo si el motor pudo cotizarla de verdad. El importe se
// calcula y se descarta en el servidor -- ver checkConfig en lib/publicQuote.ts.
export type AvailabilityStatus =
  | { kind: "missing-data" }
  | { kind: "checking" }
  | { kind: "available" }
  /** `reason` dice *por qué* no se puede cuando se sabe (p. ej. la medida excede el máximo
   *  fabricable de ese estilo), en vez de un "No disponible" sin explicación. */
  | { kind: "unavailable"; reason?: string };

export const SIZE_CTA = "Indica tu medida";

export function availabilityLabel(status: AvailabilityStatus): string {
  switch (status.kind) {
    case "missing-data":
      return SIZE_CTA;
    case "checking":
      return "Revisando…";
    case "available":
      return "Disponible en tu medida";
    case "unavailable":
      return status.reason ?? "No disponible en esa medida";
  }
}

/** Validación de medida idéntica a la del servidor (lib/publicQuote.ts parseConfig), usada para
 *  no mandar al motor configuraciones que ya se sabe que va a rechazar. El servidor sigue siendo
 *  la autoridad: esto solo ahorra el viaje y permite explicar el motivo sin esperarlo. */
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
