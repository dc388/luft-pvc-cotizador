import type { FrameNode } from "@/types/domain";
import { flattenToRects } from "@/lib/tree";

// Tolerancia al comparar bordes: los repartos salen de fracciones (ratios), así que dos hojas que
// comparten un montante pueden dar 900 y 900.0000001. Medio milímetro no existe en fabricación.
const TOL_MM = 0.5;

export type CotaSegment = { at: number; len: number };

/** Los tramos entre divisiones consecutivas de un eje. Suman siempre la medida total. */
export function chain(edges: number[], total: number): CotaSegment[] {
  const stops: number[] = [];
  for (const v of [0, ...edges, total].sort((a, b) => a - b)) {
    if (v < -TOL_MM || v > total + TOL_MM) continue;
    if (!stops.length || v - stops[stops.length - 1] > TOL_MM) stops.push(v);
  }
  return stops.slice(0, -1).map((at, i) => ({ at, len: stops[i + 1] - at }));
}

/**
 * Las dos cadenas de cotas parciales de una composición: anchos y altos.
 *
 * Las medidas salen de flattenToRects, no de flattenToLeafFrames: son las NOMINALES del hueco, que
 * es lo que tiene que sumar el total. Las de fabricación de una corredera se solapan en el
 * traslape, así que una cadena hecha con ellas sumaría más que el ancho de la ventana -- que es
 * justamente el error que una cadena de cotas sirve para detectar. La medida de fabricación de la
 * hoja sigue estando, en su etiqueta (ver FrameNodeView).
 */
export function cotaChains(tree: FrameNode, width: number, height: number) {
  const rects = flattenToRects(tree, width, height);
  return {
    xs: chain(rects.flatMap((r) => [r.x, r.x + r.w]), width),
    ys: chain(rects.flatMap((r) => [r.y, r.y + r.h]), height),
  };
}
