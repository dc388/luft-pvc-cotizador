"use client";

import type { CSSProperties, MouseEvent } from "react";
import type { ColorItem, FocusScope, FrameNode, System } from "@/types/domain";
import { flattenToLeafFrames } from "@/lib/tree";
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
  system: System;
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
  system,
  focusScope,
  focusPart,
  focusSide,
  showFocus = true,
  onPartClick,
  onAssemblyMarcoClick,
  onCentralLockClick,
}: Props) {
  const light = color.name === "Blanco";
  const frames = flattenToLeafFrames(tree, width, height, system.frameSeatMm, system.centerOverlapMm);
  return (
    <div className="modelStage" style={{ "--ar": `${width}/${height}` } as CSSProperties}>
      <div className={`window ${light ? "whiteFrame" : ""}`} style={{ "--frame": color.hex ?? "#dfe2dc" } as CSSProperties}>
        {frames.map((frame, i) => (
          <FrameNodeView
            key={frame.id}
            frame={frame}
            overallWidthMm={width}
            overallHeightMm={height}
            zIndex={i + 1}
            selectedId={selectedId}
            focusScope={focusScope}
            focusPart={focusPart}
            focusSide={focusSide}
            onPartClick={onPartClick}
          />
        ))}
        <CentralLocks tree={tree} widthMm={width} heightMm={height} onCentralLockClick={onCentralLockClick} />
        <AssemblyMarcoHits showFocus={showFocus} focusScope={focusScope} focusPart={focusPart} focusSide={focusSide} onClick={onAssemblyMarcoClick} />
      </div>
    </div>
  );
}
