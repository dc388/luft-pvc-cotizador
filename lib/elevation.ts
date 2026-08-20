import { glassSizeMm } from "@/data/glazing";

/**
 * Reparto de una hoja en sus componentes, para dibujarla como una alzada de carpintería.
 *
 * El problema que resuelve: marco, hoja y junquillo se pintaban todos del color del folio, con una
 * diferencia de brillo mínima entre ellos, y el junquillo directamente no se dibujaba en 2D. Todo
 * se leía como una sola masa. Físicamente es cierto -- una ventana blanca es toda blanca -- pero
 * esto es una herramienta de diseño técnico: hay que poder distinguir las piezas.
 *
 * QUÉ ES MEDIDA Y QUÉ ES CONVENIENCIA DE DIBUJO, que es la distinción importante:
 *
 * - `glassWMm` / `glassHMm` son MEDIDA. Salen de `glassSizeMm`, la misma función con la que se
 *   compra el vidrio y se emite la lista de corte. El vidrio del dibujo mide lo que mide el vidrio.
 * - `profileWMm` / `profileHMm` son MEDIDA por complemento: lo que queda entre el canto de la hoja
 *   y el canto del vidrio es exactamente el perfil que tapa ese canto.
 * - `beadWMm` / `beadHMm` son CONVENCIÓN DE DIBUJO, no medida, y por eso van marcadas aparte con
 *   `beadIsDrawingConvention`. El reparto interno de esa franja entre cara de perfil y junquillo
 *   necesita el ancho de cara del perfil, y ese dato no está en el catálogo: `System.frame` y
 *   `System.sash` son PRECIOS por metro, no anchos. El único ancho de cara que aparece en la
 *   documentación de Aluplast es el 47,3 mm del sistema Ideal IS (ver el comentario de `beadFor` en
 *   data/glazing.ts), y no es atribuible al resto de los sistemas. Antes que inventar un número de
 *   fabricación, se dibuja el junquillo como una fracción declarada del perfil: sirve para verlo y
 *   seleccionarlo, no entra en ningún cálculo, corte ni precio, y la leyenda lo dice.
 */

/** Fracción del perfil que se dibuja como junquillo. Proporción de dibujo, NO una medida. */
export const BEAD_DRAW_SHARE = 0.38;

export type ElevationBands = {
  glassWMm: number;
  glassHMm: number;
  profileWMm: number;
  profileHMm: number;
  beadWMm: number;
  beadHMm: number;
  /** El vidrio sale de un descuento calibrado del fabricante para este sistema. */
  glassCalibrated: boolean;
  /** Siempre true: recordatorio de que el junquillo del dibujo no es una medida. */
  beadIsDrawingConvention: true;
};

export function elevationBands(
  fabWMm: number,
  fabHMm: number,
  systemName: string,
  glazesIntoFrame: boolean
): ElevationBands {
  const glass = glassSizeMm(fabWMm, fabHMm, systemName, glazesIntoFrame);
  // El perfil es el complemento, repartido a los dos lados del eje. Nunca negativo: una hoja más
  // pequeña que su propio descuento no existe, pero el dibujo no es el sitio donde avisar de eso
  // (lo hace el aviso de medida del conjunto, ver app/Workspace.tsx).
  const profileWMm = Math.max(0, (fabWMm - glass.wMm) / 2);
  const profileHMm = Math.max(0, (fabHMm - glass.hMm) / 2);
  return {
    glassWMm: glass.wMm,
    glassHMm: glass.hMm,
    profileWMm,
    profileHMm,
    beadWMm: profileWMm * BEAD_DRAW_SHARE,
    beadHMm: profileHMm * BEAD_DRAW_SHARE,
    glassCalibrated: glass.calibrated,
    beadIsDrawingConvention: true,
  };
}

/**
 * Los mismos repartos en porcentaje de la hoja, que es como los consume el CSS del dibujo.
 *
 * Se devuelven con un mínimo en píxeles aparte (`minPx`) porque a escala real un perfil de 10 mm en
 * una ventana de 1800 dibujada a 257 px mide 1.4 px: correcto y ilegible. El CSS combina los dos
 * con `max()`, así que el dibujo respeta la escala mientras se pueda ver, y por debajo de eso
 * garantiza que la franja siga existiendo en pantalla.
 */
export function elevationPercents(bands: ElevationBands, fabWMm: number, fabHMm: number) {
  const pct = (mm: number, total: number) => (total > 0 ? (mm / total) * 100 : 0);
  return {
    profileX: pct(bands.profileWMm, fabWMm),
    profileY: pct(bands.profileHMm, fabHMm),
    beadX: pct(bands.beadWMm, fabWMm),
    beadY: pct(bands.beadHMm, fabHMm),
  };
}
