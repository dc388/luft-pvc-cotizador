"use client";

import { Fragment, useState, type ReactNode } from "react";
import type { FocusScope, FrameNode } from "@/types/domain";
import { wingName } from "@/lib/tree";
import { SIDES, SIDE_LABELS, type PartKind, type SideKey } from "./frameTypes";

type Props = {
  tree: FrameNode;
  selectedId: string;
  focusScope: FocusScope;
  focusPart: PartKind | null;
  focusSide: SideKey | null;
  onSelectMarco: () => void;
  onSelectMarcoSide: (side: SideKey) => void;
  onSelectLeaf: (id: string, part: PartKind) => void;
  onSelectLeafSide: (id: string, side: SideKey) => void;
  onSelectGlassSide: (id: string, side: SideKey) => void;
};

const INDENT_PX = 14;

// Left-panel project explorer, styled after RA Workshop: Marco de conjunto + its 4 sides, then
// the composition tree itself -- every division (SplitNode) is a collapsible row, and every
// pane (LeafNode) keeps its 4 marco sides, Gancho (herraje) row when operable, and Vidrio
// header + 4 glass sides, indented under whichever divisions contain it. Collapsing a division
// hides its whole sub-tree, same idea as any file/layer explorer.
export function ExplorerTree({
  tree,
  selectedId,
  focusScope,
  focusPart,
  focusSide,
  onSelectMarco,
  onSelectMarcoSide,
  onSelectLeaf,
  onSelectLeafSide,
  onSelectGlassSide,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleSplit = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  let leafNumber = 0;

  function renderNode(node: FrameNode, depth: number): ReactNode {
    if (node.kind === "split") {
      const isCollapsed = collapsed.has(node.id);
      return (
        <div key={node.id} className="explorerSplitGroup">
          <button
            type="button"
            className="explorerSplitHeader"
            style={{ paddingLeft: 10 + depth * INDENT_PX }}
            onClick={() => toggleSplit(node.id)}
            aria-expanded={!isCollapsed}
          >
            <span className={`explorerChevron ${isCollapsed ? "" : "open"}`}>▸</span>
            División {node.axis === "col" ? "vertical" : "horizontal"} · {node.children.length} partes
          </button>
          {!isCollapsed && node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    const leaf = node;
    leafNumber += 1;
    const i = leafNumber;
    const leafActive = focusScope === "leaf" && leaf.id === selectedId;
    const leafIsOperable = leaf.wing !== "fixed" && leaf.wing !== "inactive" && leaf.wing !== "sliding-fixed";
    return (
      <Fragment key={leaf.id}>
        <button
          type="button"
          className={`explorerLeaf ${leafActive && !focusSide && focusPart !== "herraje" && focusPart !== "vidrio" ? "active" : ""}`}
          style={{ paddingLeft: 10 + depth * INDENT_PX }}
          onClick={() => onSelectLeaf(leaf.id, "marco")}
        >
          Hoja {i} · {wingName(leaf.wing)}
        </button>
        <div className="explorerSides">
          {SIDES.map((s) => (
            <button
              key={s}
              type="button"
              className={`explorerSide ${leafActive && focusPart === "marco" && focusSide === s ? "active" : ""}`}
              onClick={() => onSelectLeafSide(leaf.id, s)}
            >
              Lado - {SIDE_LABELS[s]}
            </button>
          ))}
        </div>
        {leafIsOperable && (
          <button
            type="button"
            className={`explorerGancho ${leafActive && focusPart === "herraje" ? "active" : ""}`}
            onClick={() => onSelectLeaf(leaf.id, "herraje")}
          >
            Gancho - Herraje
          </button>
        )}
        <div className="explorerVidrioHeader">Vidrio</div>
        <div className="explorerSides">
          {SIDES.map((s) => (
            <button
              key={s}
              type="button"
              className={`explorerSide ${leafActive && focusPart === "vidrio" && focusSide === s ? "active" : ""}`}
              onClick={() => onSelectGlassSide(leaf.id, s)}
            >
              Lado - {SIDE_LABELS[s]}
            </button>
          ))}
        </div>
      </Fragment>
    );
  }

  return (
    <div className="explorerTree">
      <button type="button" className={`explorerMarco ${focusScope === "assembly" && !focusSide ? "active" : ""}`} onClick={onSelectMarco}>
        Marco
      </button>
      <div className="explorerSides">
        {SIDES.map((s) => (
          <button
            key={s}
            type="button"
            className={`explorerSide ${focusScope === "assembly" && focusSide === s ? "active" : ""}`}
            onClick={() => onSelectMarcoSide(s)}
          >
            Lado - {SIDE_LABELS[s]}
          </button>
        ))}
      </div>
      {renderNode(tree, 0)}
    </div>
  );
}
