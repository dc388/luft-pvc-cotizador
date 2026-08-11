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
 *  No es lo mismo que SUMMARY, que revisa el proyecto completo (todos los diseños).
 *
 *  NO hay etapa de línea/marca. Toda la cancelería que se cotiza aquí es de perfilería Aluplast,
 *  así que preguntarla era pedirle al cliente que "eligiera" entre una sola opción. La marca se
 *  deriva del catálogo (lib/publicCatalog.ts) y se le muestra como característica del producto,
 *  no como decisión. Si algún día hay una segunda línea pública, la etapa vuelve aquí. */
export const S = {
  PRODUCT: 0,
  STYLE: 1,
  SIZE: 2,
  COLOR: 3,
  GLASS: 4,
  CONFIRM: 5,
  SUMMARY: 6,
  PROCESS: 7,
  CONTACT: 8,
  DONE: 9,
} as const;

export type PublicStep = (typeof S)[keyof typeof S];

export function publicStepName(step: number): string {
  return PUBLIC_STEPS[step] ?? PUBLIC_STEPS[S.PRODUCT];
}
