"use client";

import type { CSSProperties, MouseEvent } from "react";
import type { ColorItem, FocusScope, FrameNode } from "@/types/domain";
import { FrameNodeView } from "./FrameNodeView";
import { CentralLocks } from "./CentralLocks";
import { AssemblyMarcoHits } from "./AssemblyMarcoHits";
import type { PartKind, SideKey } from "./frameTypes";

type Props = {
  tree: FrameNode;
  width: number;
  height: number;
  // Pass "" for a non-interactive/report diagram (matches static's itemDiagram, which always
  // renders with selectedId="").
  selectedId: string;
  color: ColorItem;
  focusScope: FocusScope;
  focusPart: PartKind | null;
  focusSide: SideKey | null;
  // false for the static report diagram -- it must never reflect the live editor's selection.
  showFocus?: boolean;
  onPartClick: (id: string, part: PartKind, side: SideKey | null, e: MouseEvent<HTMLButtonElement>) => void;
  onAssemblyMarcoClick: (side: SideKey) => void;
  onCentralLockClick: (id: string) => void;
};

export function FrameCanvas({
  tree,
  width,
  height,
  selectedId,
  color,
  focusScope,
  focusPart,
  focusSide,
  showFocus = true,
  onPartClick,
  onAssemblyMarcoClick,
  onCentralLockClick,
}: Props) {
  const light = color.name === "Blanco";
  return (
    <div className="modelStage" style={{ "--ar": `${width}/${height}` } as CSSProperties}>
      <div className={`window ${light ? "whiteFrame" : ""}`} style={{ "--frame": color.hex ?? "#dfe2dc" } as CSSProperties}>
        <FrameNodeView
          node={tree}
          widthMm={width}
          heightMm={height}
          selectedId={selectedId}
          flexBasis="1 1 100%"
          focusScope={focusScope}
          focusPart={focusPart}
          focusSide={focusSide}
          onPartClick={onPartClick}
        />
        <CentralLocks tree={tree} widthMm={width} heightMm={height} onCentralLockClick={onCentralLockClick} />
        <AssemblyMarcoHits showFocus={showFocus} focusScope={focusScope} focusPart={focusPart} focusSide={focusSide} onClick={onAssemblyMarcoClick} />
      </div>
    </div>
  );
}
