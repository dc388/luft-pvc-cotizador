"use client";

import type { CSSProperties, MouseEvent } from "react";
import type { FocusScope } from "@/types/domain";
import type { LeafFrame } from "@/lib/tree";
import { hasSashWing, isOperableWing, wingName, MOVABLE_SLIDING_WINGS, SLIDING_WINGS } from "@/lib/tree";
import { HandleIcon, MotionArrowIcon, WingIcon } from "./icons";
import { SIDES, SIDE_LABELS, type Edges, type PartKind, type SideKey } from "./frameTypes";

type Props = {
  frame: LeafFrame;
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
export function FrameNodeView({ frame, overallWidthMm, overallHeightMm, zIndex, selectedId, focusScope, focusPart, focusSide, onPartClick }: Props) {
  const { id, wing, spec, edges: e } = frame;
  const hasSash = hasSashWing(wing);
  const isOperable = isOperableWing(wing);
  const showOpeningLines = isOperable && !SLIDING_WINGS.includes(wing);
  const isFixedGlyph = wing === "fixed" || wing === "inactive" || wing === "sliding-fixed";
  const isMovableSliding = MOVABLE_SLIDING_WINGS.includes(wing);
  const borderWidth = `${edgeWidth(e.top)}px ${edgeWidth(e.right)}px ${edgeWidth(e.bottom)}px ${edgeWidth(e.left)}px`;
  // No specific side picked (focusSide === null) means the whole marco is focused -- matches
  // Scene3D's isSelectedPart, which highlights all four sides in that case.
  const isSideFocused = (side: SideKey) => focusScope === "leaf" && id === selectedId && focusPart === "marco" && (!focusSide || focusSide === side);
  const isGlassSideFocused = (side: SideKey) => focusScope === "leaf" && id === selectedId && focusPart === "vidrio" && focusSide === side;

  const style: CSSProperties = {
    position: "absolute",
    left: `${(frame.fabX / overallWidthMm) * 100}%`,
    top: `${(frame.fabY / overallHeightMm) * 100}%`,
    width: `${(frame.fabW / overallWidthMm) * 100}%`,
    height: `${(frame.fabH / overallHeightMm) * 100}%`,
    borderWidth,
    zIndex,
  };

  return (
    <div className={`pane ${id === selectedId ? "selectedPane" : ""}`} style={style} data-leaf={id}>
      {hasSash && <div className="sashRing" />}
      <div className="glassFill" />
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
          <span className="motion">
            {isFixedGlyph ? (
              <b className="motionFixed">FIJO</b>
            ) : isMovableSliding ? (
              <MotionArrowIcon direction={spec.direction} size={26} />
            ) : (
              <WingIcon id={wing} size={24} />
            )}
          </span>
          {showOpeningLines && <i className="openingLines" />}
        </button>
      ) : (
        <span className="motion">
          <WingIcon id={wing} size={22} />
        </span>
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
      {isOperable && (
        <button type="button" className="hit hitHerraje" title="Herraje / manilla" onClick={(ev) => onPartClick(id, "herraje", null, ev)}>
          <HandleIcon size={14} />
        </button>
      )}
      <em>{wingName(wing)}</em>
      <small className="paneHardware">{spec.hardware.replace("Roto · ", "")}</small>
      <b className="paneDim">
        {Math.round(frame.fabW)} × {Math.round(frame.fabH)}
      </b>
    </div>
  );
}
