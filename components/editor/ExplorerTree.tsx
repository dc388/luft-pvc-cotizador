"use client";

import { Fragment } from "react";
import type { FocusScope, FrameNode } from "@/types/domain";
import { walkLeaves, wingName } from "@/lib/tree";
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

// Left-panel project explorer, styled after RA Workshop: Marco de conjunto + its 4 sides,
// then every leaf with its own 4 marco sides, its Gancho (herraje) row when operable, and its
// Vidrio header + 4 glass sides. No collapse/expand — always fully listed, same interaction
// weight as clicking the equivalent hit zone on the 2D canvas.
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
  const leaves = walkLeaves(tree);
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
      {leaves.map((leaf, i) => {
        const leafActive = focusScope === "leaf" && leaf.id === selectedId;
        const leafIsOperable = leaf.wing !== "fixed" && leaf.wing !== "inactive" && leaf.wing !== "sliding-fixed";
        return (
          <Fragment key={leaf.id}>
            <button
              type="button"
              className={`explorerLeaf ${leafActive && !focusSide && focusPart !== "herraje" && focusPart !== "vidrio" ? "active" : ""}`}
              onClick={() => onSelectLeaf(leaf.id, "marco")}
            >
              Hoja {i + 1} · {wingName(leaf.wing)}
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
      })}
    </div>
  );
}
