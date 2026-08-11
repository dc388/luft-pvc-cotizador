/** Índice único de las pantallas del cotizador público.
 *
 *  Lo comparten la interfaz (components/cotizar/QuoteWizard.tsx) y el asesor
 *  (components/cotizar/publicAssistant.ts, lib/publicAssistantModel.ts). Antes existían dos
 *  arreglos de pasos y varios números mágicos (`step >= 9`, `step === 11`); al fusionar
 *  Instalación y Precio en una sola pantalla todos apuntaban a la etapa equivocada, así que
 *  la etapa se nombra, no se cuenta a mano. Si se agrega o quita una pantalla, este archivo
 *  es el único lugar que hay que tocar.
 */

export const PUBLIC_STEPS = [
  "Producto",
  "Línea",
  "Estilo",
  "Medidas",
  "Color",
  "Vidrio",
  "Instalación y precio",
  "Resumen",
  "Proceso",
  "Contacto",
  "Listo",
] as const;

/** CONFIRM reúne lo que antes eran dos pantallas: el interruptor de instalación y el total.
 *  No es lo mismo que SUMMARY, que revisa el proyecto completo (todos los diseños). */
export const S = {
  PRODUCT: 0,
  BRAND: 1,
  STYLE: 2,
  SIZE: 3,
  COLOR: 4,
  GLASS: 5,
  CONFIRM: 6,
  SUMMARY: 7,
  PROCESS: 8,
  CONTACT: 9,
  DONE: 10,
} as const;

export type PublicStep = (typeof S)[keyof typeof S];

export function publicStepName(step: number): string {
  return PUBLIC_STEPS[step] ?? PUBLIC_STEPS[S.PRODUCT];
}
