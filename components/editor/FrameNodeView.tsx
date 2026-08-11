"use client";

import type { CSSProperties, MouseEvent } from "react";
import type { FocusScope, FrameNode } from "@/types/domain";
import { hasSashWing, isOperableWing, isSlidingLeaf, wingName, MOVABLE_SLIDING_WINGS, SLIDING_WINGS } from "@/lib/tree";
import { HandleIcon, MotionArrowIcon, WingIcon } from "./icons";
import { SIDES, SIDE_LABELS, type Edges, type PartKind, type SideKey } from "./frameTypes";

type Props = {
  node: FrameNode;
  widthMm: number;
  heightMm: number;
  selectedId: string;
  flexBasis: string;
  edges?: Edges;
  focusScope: FocusScope;
  focusPart: PartKind | null;
  focusSide: SideKey | null;
  onPartClick: (id: string, part: PartKind, side: SideKey | null, e: MouseEvent<HTMLButtonElement>) => void;
};

function edgeWidth(v: Edges["top"] | undefined): number {
  return v === true ? 5 : v === "overlap" ? 1 : 2;
}

// Recursive renderer for the FrameNode tree, matching renderFrameNode in static/cotizador.html
// 1:1: SplitNodes become flex containers (row axis stacks children vertically, col axis lays
// them out side-by-side) sized by `ratios`; LeafNodes render a marco/sash/glass "pane" with
// independent hit zones for each of its 4 marco sides, its hoja, its vidrio + 4 glass sides,
// and its herraje — every one of those sub-parts is its own clickable button, not a single
// whole-leaf click target.
export function FrameNodeView({ node, widthMm, heightMm, selectedId, flexBasis, edges, focusScope, focusPart, focusSide, onPartClick }: Props) {
  const e: Edges = edges ?? { top: true, right: true, bottom: true, left: true };

  if (node.kind === "split") {
    const n = node.children.length;
    return (
      <div className={`splitNode ${node.axis === "row" ? "axisRow" : "axisCol"}`} style={{ flex: flexBasis }}>
        {node.children.map((child, i) => {
          // Sliding leaves that meet mid-run don't get a structural travesaño between them —
          // real correderas overlap/interlock there, so that shared edge renders far thinner
          // than a genuine mullion shared by e.g. two casement leaves.
          const slideNeighbor = (j: number) => j >= 0 && j < n && isSlidingLeaf(child) && isSlidingLeaf(node.children[j]);
          const childEdges: Edges =
            node.axis === "col"
              ? {
                  top: e.top,
                  bottom: e.bottom,
                  left: i === 0 ? e.left : slideNeighbor(i - 1) ? "overlap" : false,
                  right: i === n - 1 ? e.right : slideNeighbor(i + 1) ? "overlap" : false,
                }
              : {
                  top: i === 0 ? e.top : slideNeighbor(i - 1) ? "overlap" : false,
                  bottom: i === n - 1 ? e.bottom : slideNeighbor(i + 1) ? "overlap" : false,
                  left: e.left,
                  right: e.right,
                };
          return (
            <FrameNodeView
              key={child.id}
              node={child}
              widthMm={node.axis === "col" ? widthMm * node.ratios[i] : widthMm}
              heightMm={node.axis === "row" ? heightMm * node.ratios[i] : heightMm}
              selectedId={selectedId}
              flexBasis={`${node.ratios[i]} 1 0%`}
              edges={childEdges}
              focusScope={focusScope}
              focusPart={focusPart}
              focusSide={focusSide}
              onPartClick={onPartClick}
            />
          );
        })}
      </div>
    );
  }

  const hasSash = hasSashWing(node.wing);
  const isOperable = isOperableWing(node.wing);
  const showOpeningLines = isOperable && !SLIDING_WINGS.includes(node.wing);
  const isFixedGlyph = node.wing === "fixed" || node.wing === "inactive" || node.wing === "sliding-fixed";
  const isMovableSliding = MOVABLE_SLIDING_WINGS.includes(node.wing);
  const borderWidth = `${edgeWidth(e.top)}px ${edgeWidth(e.right)}px ${edgeWidth(e.bottom)}px ${edgeWidth(e.left)}px`;
  // No specific side picked (focusSide === null) means the whole marco is focused -- matches
  // Scene3D's isSelectedPart, which highlights all four sides in that case.
  const isSideFocused = (side: SideKey) => focusScope === "leaf" && node.id === selectedId && focusPart === "marco" && (!focusSide || focusSide === side);
  const isGlassSideFocused = (side: SideKey) => focusScope === "leaf" && node.id === selectedId && focusPart === "vidrio" && focusSide === side;

  return (
    <div
      className={`pane ${node.id === selectedId ? "selectedPane" : ""}`}
      style={{ flex: flexBasis, borderWidth } as CSSProperties}
      data-leaf={node.id}
    >
      {hasSash && <div className="sashRing" />}
      <div className="glassFill" />
      {SIDES.map((side) => (
        <button
          key={`marco-${side}`}
          type="button"
          className={`hit hitMarcoSide hitMarco${side[0].toUpperCase()}${side.slice(1)} ${isSideFocused(side) ? "marcoSideFocus" : ""}`}
          title={`Marco · Lado ${SIDE_LABELS[side]}`}
          aria-label={`Marco - Lado ${SIDE_LABELS[side]} de ${wingName(node.wing)}`}
          onClick={(ev) => onPartClick(node.id, "marco", side, ev)}
        />
      ))}
      {hasSash ? (
        <button type="button" className="hit hitHoja" title="Hoja / tipo de apertura" onClick={(ev) => onPartClick(node.id, "hoja", null, ev)}>
          <span className="motion">
            {isFixedGlyph ? (
              <b className="motionFixed">FIJO</b>
            ) : isMovableSliding ? (
              <MotionArrowIcon direction={node.spec.direction} size={26} />
            ) : (
              <WingIcon id={node.wing} size={24} />
            )}
          </span>
          {showOpeningLines && <i className="openingLines" />}
        </button>
      ) : (
        <span className="motion">
          <WingIcon id={node.wing} size={22} />
        </span>
      )}
      <button type="button" className="hit hitVidrio" title="Vidrio" onClick={(ev) => onPartClick(node.id, "vidrio", null, ev)} />
      {SIDES.map((side) => (
        <button
          key={`vidrio-${side}`}
          type="button"
          className={`hit hitVidrioSide hitVidrio${side[0].toUpperCase()}${side.slice(1)} ${isGlassSideFocused(side) ? "marcoSideFocus" : ""}`}
          title={`Vidrio · Lado ${SIDE_LABELS[side]}`}
          aria-label={`Vidrio - Lado ${SIDE_LABELS[side]}`}
          onClick={(ev) => onPartClick(node.id, "vidrio", side, ev)}
        />
      ))}
      {isOperable && (
        <button type="button" className="hit hitHerraje" title="Herraje / manilla" onClick={(ev) => onPartClick(node.id, "herraje", null, ev)}>
          <HandleIcon size={14} />
        </button>
      )}
      <em>{wingName(node.wing)}</em>
      <small className="paneHardware">{node.spec.hardware.replace("Roto · ", "")}</small>
      <b className="paneDim">
        {Math.round(widthMm)} × {Math.round(heightMm)}
      </b>
    </div>
  );
}
