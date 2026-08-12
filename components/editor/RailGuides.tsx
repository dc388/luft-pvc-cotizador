import type { FrameNode } from "@/types/domain";
import { walkLeaves, SLIDING_WINGS } from "@/lib/tree";

/**
 * Rieles del marco inferior. Se dibujan los que hay: el tipo de riel elegido para el conjunto
 * (`railCount`) y, si alguna hoja se mandó a un carril más alto que ese, también ese. Así el
 * dibujo no puede contradecir ni al selector "Tipo de riel" ni a la ficha de la hoja.
 *
 * No se dibuja nada en composiciones sin corredizas — una practicable no tiene guía.
 */
export function RailGuides({ tree, railCount = 0 }: { tree: FrameNode; railCount?: number }) {
  const sliding = walkLeaves(tree).filter((l) => SLIDING_WINGS.includes(l.wing));
  if (!sliding.length) return null;
  const rails = Math.max(1, railCount, ...sliding.map((l) => l.spec.railIndex || 1));
  return (
    <span className="railGuides" aria-hidden="true" title={`${rails} riel${rails > 1 ? "es" : ""}`}>
      {Array.from({ length: rails }, (_, i) => (
        <i key={i} className="railGuide" />
      ))}
    </span>
  );
}
