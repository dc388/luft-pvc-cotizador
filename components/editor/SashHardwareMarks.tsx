"use client";

import type { CSSProperties, MouseEvent } from "react";
import type { PaneSpec } from "@/types/domain";
import { handleTitle, type Edge, type SashHardware } from "@/lib/hardware";

type Props = {
  hw: SashHardware;
  spec: PaneSpec;
  /** Click en la manilla = seleccionar el herraje de esta hoja. La manilla es un control, no
   *  un adorno: es el punto de entrada natural a "Herraje" y "Manilla / cierre" de la ficha. */
  onHandleClick?: (e: MouseEvent<HTMLButtonElement>) => void;
};

const VERTICAL: Edge[] = ["left", "right"];

/** Posición absoluta de un elemento montado sobre un canto, a partir de la posición 0..1.
 *  En cantos verticales el 0 es abajo (así se mide la altura de manilla en obra). */
function edgeStyle(edge: Edge, offset: number): CSSProperties {
  if (edge === "left") return { left: 0, bottom: `${offset * 100}%` };
  if (edge === "right") return { right: 0, bottom: `${offset * 100}%` };
  if (edge === "top") return { top: 0, left: `${offset * 100}%` };
  return { bottom: 0, left: `${offset * 100}%` };
}

/** Líneas del sentido de apertura, en la convención de alzado de carpintería: el vértice de la
 *  "V" apunta al canto con bisagras. Se dibujan en SVG estirado a la hoja (preserveAspectRatio
 *  "none") con trazo de ancho constante, para que no engorden ni adelgacen con la proporción. */
function OpeningSymbol({ hw }: { hw: SashHardware }) {
  if (hw.symbol === "none") return null;

  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, vectorEffect: "non-scaling-stroke" as const };
  const paths: React.ReactNode[] = [];

  if (hw.symbol === "casement" || hw.symbol === "tilt-turn") {
    // Vértice en el canto de bisagras.
    const apexX = hw.hingeEdge === "left" ? 0 : 100;
    const openX = hw.hingeEdge === "left" ? 100 : 0;
    paths.push(<path key="c" d={`M${openX} 0 L${apexX} 50 L${openX} 100`} {...stroke} />);
  }
  if (hw.symbol === "tilt-turn") {
    // Oscilobatiente: además del giro lateral, la hoja bascula sobre el canto inferior.
    paths.push(<path key="t" d="M0 0 L50 100 L100 0" {...stroke} strokeDasharray="5 4" />);
  }
  if (hw.symbol === "project") {
    paths.push(<path key="p" d="M0 0 L50 100 L100 0" {...stroke} strokeDasharray="5 4" />);
  }
  if (hw.symbol === "hopper") {
    paths.push(<path key="h" d="M0 100 L50 0 L100 100" {...stroke} strokeDasharray="5 4" />);
  }
  if (hw.symbol === "pivot") {
    paths.push(<path key="v1" d="M50 0 L50 100" {...stroke} strokeDasharray="5 4" />);
    paths.push(<circle key="v2" cx="50" cy="50" r="9" {...stroke} />);
  }

  return (
    <svg className="sashSymbol" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {paths}
    </svg>
  );
}

/**
 * Manillas, bisagras, pivotes y puntos de cierre de UNA hoja, colocados según su configuración
 * (tipo de apertura, dirección, tipo de manilla y altura de manilla en mm). Todo va con
 * pointer-events desactivado salvo la manilla, para no robarle el clic a las zonas de
 * marco/hoja/vidrio que ya existen.
 */
export function SashHardwareMarks({ hw, spec, onHandleClick }: Props) {
  if (!hw.operable) return null;

  const isVerticalHandle = hw.handleEdge !== null && VERTICAL.includes(hw.handleEdge);

  return (
    <>
      <OpeningSymbol hw={hw} />

      {hw.hingeEdge && (
        <span className={`hingeSet hingeSet-${hw.hingeEdge}`} aria-hidden="true">
          <i className="hinge" />
          <i className="hinge" />
          <i className="hinge" />
        </span>
      )}

      {hw.pivot && (
        <span className="pivotSet" aria-hidden="true">
          <i className="pivotPoint pivotPoint-top" />
          <i className="pivotPoint pivotPoint-bottom" />
        </span>
      )}

      {hw.lockPoints > 0 && hw.handleEdge && (
        <span className={`lockSet lockSet-${hw.handleEdge}`} aria-hidden="true">
          {Array.from({ length: hw.lockPoints }, (_, i) => (
            <i key={i} className="lockPoint" />
          ))}
        </span>
      )}

      {hw.handleKind !== "none" && hw.handleEdge && (
        <button
          type="button"
          className={`sashHandle sashHandle-${hw.handleKind} sashHandle-${hw.handleEdge} ${isVerticalHandle ? "sashHandleV" : "sashHandleH"}`}
          style={edgeStyle(hw.handleEdge, hw.handleOffset)}
          title={handleTitle(hw, spec)}
          aria-label={handleTitle(hw, spec)}
          onClick={onHandleClick}
        >
          <i className="sashHandleRose" />
          <i className="sashHandleLever" />
        </button>
      )}
    </>
  );
}
