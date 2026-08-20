"use client";

import type { CSSProperties, MouseEvent } from "react";
import type { FocusScope, System } from "@/types/domain";
import type { LeafFrame } from "@/lib/tree";
import { motionGlyph, wingName, SLIDING_WINGS } from "@/lib/tree";
import { resolveSashHardware } from "@/lib/hardware";
import { elevationBands, elevationPercents } from "@/lib/elevation";
import { SashHardwareMarks } from "./SashHardwareMarks";
import { SIDES, SIDE_LABELS, type Edges, type PartKind, type SideKey } from "./frameTypes";

type Props = {
  frame: LeafFrame;
  /** Hace falta para repartir la hoja en sus componentes a escala -- ver lib/elevation.ts. */
  system: System;
  overallWidthMm: number;
  overallHeightMm: number;
  // Later leaves win the shared seam: whichever sliding leaf is drawn on top there reads as
  // the one physically in front at that traslape -- an arbitrary but consistent choice until
  // the app tracks which rail/track each leaf actually rides.
  zIndex: number;
  selectedId: string;
  focusScope: FocusScope;
  focusPart: PartKind | null;
  focusSide: SideKey | null;
  onPartClick: (id: string, part: PartKind, side: SideKey | null, e: MouseEvent<HTMLButtonElement>) => void;
};

function edgeWidth(v: Edges["top"] | undefined): number {
  return v === true ? 5 : v === "overlap" ? 1 : 2;
}

// Renders one leaf's marco/sash/glass "pane" -- absolutely positioned from its LeafFrame's
// real fabrication rect (see flattenToLeafFrames) so sliding leaves that traslape at a shared
// track boundary literally overlap on screen, with independent hit zones for each of its 4
// marco sides, its hoja, its vidrio + 4 glass sides, and its herraje.
export function FrameNodeView({ frame, system, overallWidthMm, overallHeightMm, zIndex, selectedId, focusScope, focusPart, focusSide, onPartClick }: Props) {
  const { id, wing, spec, edges: e } = frame;
  const hasSash = wing !== "fixed" && wing !== "inactive";
  const isOperable = hasSash && wing !== "sliding-fixed";
  const glyph = motionGlyph(wing, spec.direction);
  // Toda la herrajería (manilla, bisagras, pivotes, puntos de cierre y símbolo de apertura)
  // sale de la configuración de la hoja, no de su tipo a secas -- ver lib/hardware.ts.
  const hw = resolveSashHardware(wing, spec, frame.fabH);
  const isSliding = SLIDING_WINGS.includes(wing);
  const borderWidth = `${edgeWidth(e.top)}px ${edgeWidth(e.right)}px ${edgeWidth(e.bottom)}px ${edgeWidth(e.left)}px`;
  const isSideFocused = (side: SideKey) => focusScope === "leaf" && id === selectedId && focusPart === "marco" && focusSide === side;
  const isGlassSideFocused = (side: SideKey) => focusScope === "leaf" && id === selectedId && focusPart === "vidrio" && focusSide === side;

  // La hoja seleccionada se dibuja por encima de sus vecinas: su marca de selección va por fuera
  // del contorno (ver .pane.selectedPane), y sin esto la hoja siguiente la taparía justo en el
  // traslape que comparten.
  // Reparto en componentes: el vidrio a escala real y el perfil como su complemento (medida), y el
  // junquillo como fraccion declarada del perfil (dibujo). Ver lib/elevation.ts.
  const bands = elevationBands(frame.fabW, frame.fabH, system.name, !hasSash);
  const pct = elevationPercents(bands, frame.fabW, frame.fabH);

  const style: CSSProperties = {
    position: "absolute",
    left: `${(frame.fabX / overallWidthMm) * 100}%`,
    top: `${(frame.fabY / overallHeightMm) * 100}%`,
    width: `${(frame.fabW / overallWidthMm) * 100}%`,
    height: `${(frame.fabH / overallHeightMm) * 100}%`,
    borderWidth,
    zIndex: id === selectedId ? zIndex + 100 : zIndex,
    // El CSS los combina con max() contra un minimo en px: a escala mientras se pueda ver.
    "--perfil-x": `${pct.profileX.toFixed(3)}%`,
    "--perfil-y": `${pct.profileY.toFixed(3)}%`,
    "--junq-x": `${pct.beadX.toFixed(3)}%`,
    "--junq-y": `${pct.beadY.toFixed(3)}%`,
  } as CSSProperties;

  return (
    <div
      className={`pane ${hasSash ? "paneMovable" : "paneFixed"} ${id === selectedId ? "selectedPane" : ""}`}
      style={style}
      data-leaf={id}
    >
      {/* Capas de la alzada, de fuera hacia dentro: el perfil es la propia .pane, luego el
          junquillo y luego el vidrio. El junquillo NO se dibujaba en 2D -- existia en el 3D y en
          la lista de corte, pero no en la vista donde se lee la estructura. */}
      {hasSash && <div className="sashRing" aria-hidden="true" />}
      <div className="beadFrame" aria-hidden="true" />
      <div className={`glassFill ${bands.glassCalibrated ? "" : "glassUncalibrated"}`}>
        {/* Accesorio de sombra: si está configurado, se ve. Antes solo existía en la ficha. */}
        {spec.mallorquina && <i className="mallorquinaLouvres" aria-hidden="true" />}
      </div>
      {SIDES.map((side) => (
        <button
          key={`marco-${side}`}
          type="button"
          className={`hit hitMarcoSide hitMarco${side[0].toUpperCase()}${side.slice(1)} ${isSideFocused(side) ? "marcoSideFocus" : ""}`}
          title={`Marco · Lado ${SIDE_LABELS[side]}`}
          aria-label={`Marco - Lado ${SIDE_LABELS[side]} de ${wingName(wing)}`}
          onClick={(ev) => onPartClick(id, "marco", side, ev)}
        />
      ))}
      {hasSash ? (
        <button type="button" className="hit hitHoja" title="Hoja / tipo de apertura" onClick={(ev) => onPartClick(id, "hoja", null, ev)}>
          <span className="motion">{glyph}</span>
        </button>
      ) : (
        <span className="motion">{glyph}</span>
      )}
      <button type="button" className="hit hitVidrio" title="Vidrio" onClick={(ev) => onPartClick(id, "vidrio", null, ev)} />
      {SIDES.map((side) => (
        <button
          key={`vidrio-${side}`}
          type="button"
          className={`hit hitVidrioSide hitVidrio${side[0].toUpperCase()}${side.slice(1)} ${isGlassSideFocused(side) ? "marcoSideFocus" : ""}`}
          title={`Vidrio · Lado ${SIDE_LABELS[side]}`}
          aria-label={`Vidrio - Lado ${SIDE_LABELS[side]}`}
          onClick={(ev) => onPartClick(id, "vidrio", side, ev)}
        />
      ))}
      <SashHardwareMarks hw={hw} spec={spec} onHandleClick={(ev) => onPartClick(id, "herraje", null, ev)} />
      {/* Respaldo para llegar al herraje cuando la hoja se configuró "Sin manilla": sin esto,
          una hoja operable sin manilla se quedaba sin punto de entrada al panel de herraje. */}
      {isOperable && hw.handleKind === "none" && (
        <button type="button" className="hit hitHerraje" title="Herraje (sin manilla)" onClick={(ev) => onPartClick(id, "herraje", null, ev)}>
          ⚙
        </button>
      )}
      {/* Todo lo que la hoja tiene que decir, en UN bloque apilado en su esquina.
          Antes eran cuatro pastillas sueltas, cada una anclada a una esquina distinta, y a tamaño
          real no cabían: medido en una hoja de 80 px de ancho sumaban 178 px de etiqueta, con
          solapes de 28x16 y 16x15 px, y "Corrediza" salía cortada por el overflow de .pane.
          Apiladas en columna no pueden solaparse entre sí, y el detalle se va retirando por
          tamaño de hoja (ver la consulta de contenedor de .pane en app/globals.css) en vez de
          quedar amontonado: primero el riel y el herraje, luego el tipo, y en las hojas más
          pequeñas solo la medida. La hoja seleccionada siempre lo muestra todo. */}
      <span className="paneTags">
        <b className="tagDim" title="Medida de fabricación de la hoja">
          {Math.round(frame.fabW)} × {Math.round(frame.fabH)}
        </b>
        {/* La medida del vidrio, que es la que se le pide al proveedor. En el dibujo las franjas
            caen en su minimo de legibilidad a tamano de pantalla (ver el max() de las capas en
            app/globals.css), asi que el numero exacto tiene que estar escrito, no medido a ojo. */}
        <small className={`tagGlass ${bands.glassCalibrated ? "" : "tagGlassEstimado"}`} title={bands.glassCalibrated ? "Medida del vidrio, del descuento del fabricante" : "Medida del vidrio ESTIMADA: este sistema no tiene descuento calibrado"}>
          ▢ {Math.round(bands.glassWMm)} × {Math.round(bands.glassHMm)}
        </small>
        <em className="tagWing" title={wingName(wing)}>{wingName(wing)}</em>
        <small className="tagHw" title={spec.hardware}>{spec.hardware.replace("Roto · ", "")}</small>
        {isSliding && <small className="tagRail">Riel {spec.railIndex}</small>}
      </span>
    </div>
  );
}
