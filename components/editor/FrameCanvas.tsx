"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { ColorItem, FocusScope, FrameNode, System } from "@/types/domain";
import { flattenToLeafFrames } from "@/lib/tree";
import { FrameNodeView } from "./FrameNodeView";
import { CentralLocks } from "./CentralLocks";
import { AssemblyMarcoHits } from "./AssemblyMarcoHits";
import { RailGuides } from "./RailGuides";
import { DimensionChain } from "./DimensionChain";
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
  // Tipo de riel elegido para el conjunto, para dibujar las guías del marco inferior.
  railCount?: number;
  // false for the static report diagram -- it must never reflect the live editor's selection.
  showFocus?: boolean;
  onPartClick: (id: string, part: PartKind, side: SideKey | null, e: MouseEvent<HTMLButtonElement>) => void;
  onAssemblyMarcoClick: (side: SideKey) => void;
  onCentralLockClick: (id: string) => void;
  /** Cotas totales (editables) del conjunto. Van dentro de .modelStage para que queden pegadas al
   *  dibujo y no a una esquina del lienzo: el propietario de la medida sigue siendo Workspace, que
   *  es quien sabe confirmarla, pero el sitio donde se dibuja lo decide el dibujo. */
  children?: ReactNode;
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
  railCount = 0,
  showFocus = true,
  onPartClick,
  onAssemblyMarcoClick,
  onCentralLockClick,
  children,
}: Props) {
  const light = color.name === "Blanco";
  const frames = flattenToLeafFrames(tree, width, height, system);
  return (
    <div className="modelStage" style={{ "--ar": `${width}/${height}` } as CSSProperties}>
      <div className={`window ${light ? "whiteFrame" : ""}`} style={{ "--frame": color.hex ?? "#dfe2dc" } as CSSProperties}>
        {frames.map((frame, i) => (
          <FrameNodeView
            key={frame.id}
            frame={frame}
            system={system}
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
        <RailGuides tree={tree} railCount={railCount} />
        <CentralLocks tree={tree} widthMm={width} heightMm={height} onCentralLockClick={onCentralLockClick} />
        <AssemblyMarcoHits showFocus={showFocus} focusScope={focusScope} focusPart={focusPart} focusSide={focusSide} onClick={onAssemblyMarcoClick} />
      </div>
      <DimensionChain tree={tree} width={width} height={height} />
      {children}
    </div>
  );
}
