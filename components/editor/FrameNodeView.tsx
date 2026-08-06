"use client";

import type { MouseEvent } from "react";
import type { FrameNode, PaneSpec, WingType } from "@/types/domain";
import { wingDefs } from "@/data/wings";

type Props = {
  node: FrameNode;
  widthMm: number;
  heightMm: number;
  selectedId: string;
  flexBasis: string;
  onLeafClick: (id: string, e: MouseEvent<HTMLButtonElement>) => void;
};

function motionGlyph(wing: WingType, spec: PaneSpec) {
  if (wing === "sliding" || wing === "lift-slide" || wing === "folding-sliding") return spec.direction === "Izquierda" ? "←" : "→";
  if (wing === "fixed" || wing === "inactive") return "FIJO";
  return wingDefs.find((w) => w.id === wing)?.icon ?? "?";
}

// Recursive renderer for the FrameNode tree: SplitNodes become flex containers
// (row axis stacks children vertically, col axis lays them out side-by-side)
// sized by `ratios`; LeafNodes are the clickable pane buttons the properties
// panel and the split/assign-wing tools act on.
export function FrameNodeView({ node, widthMm, heightMm, selectedId, flexBasis, onLeafClick }: Props) {
  if (node.kind === "split") {
    return (
      <div className={`splitNode ${node.axis === "row" ? "axisRow" : "axisCol"}`} style={{ flex: flexBasis }}>
        {node.children.map((child, i) => (
          <FrameNodeView
            key={child.id}
            node={child}
            widthMm={node.axis === "col" ? widthMm * node.ratios[i] : widthMm}
            heightMm={node.axis === "row" ? heightMm * node.ratios[i] : heightMm}
            selectedId={selectedId}
            flexBasis={`${node.ratios[i]} 1 0%`}
            onLeafClick={onLeafClick}
          />
        ))}
      </div>
    );
  }

  const wingDef = wingDefs.find((w) => w.id === node.wing);
  const showOpeningLines = node.wing !== "fixed" && node.wing !== "inactive" && node.wing !== "sliding" && node.wing !== "lift-slide" && node.wing !== "folding-sliding";

  return (
    <button
      type="button"
      aria-label={`Editar ${wingDef?.name ?? node.wing}`}
      className={`pane ${selectedId === node.id ? "selectedPane" : ""}`}
      style={{ flex: flexBasis }}
      onClick={(e) => onLeafClick(node.id, e)}
    >
      <span className="motion">{motionGlyph(node.wing, node.spec)}</span>
      {showOpeningLines && <i className="openingLines" />}
      <em>{wingDef?.name ?? node.wing}</em>
      <small className="paneHardware">{node.spec.hardware.replace("Roto · ", "")}</small>
      <b className="paneDim">{Math.round(widthMm)} × {Math.round(heightMm)}</b>
    </button>
  );
}
