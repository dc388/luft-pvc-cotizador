"use client";

import { forwardRef, useImperativeHandle, type CSSProperties, type MouseEvent } from "react";
import type { ColorItem, FocusScope, FrameNode, Tool } from "@/types/domain";
import { FrameNodeView } from "./FrameNodeView";
import { CentralLocks } from "./CentralLocks";
import { AssemblyMarcoHits } from "./AssemblyMarcoHits";
import { DimensionOverlay } from "./DimensionOverlay";
import { usePanZoom } from "./usePanZoom";
import type { PartKind, SideKey } from "./frameTypes";

export type FrameCanvasHandle = { zoomIn: () => void; zoomOut: () => void; fit: () => void; resetZoom: () => void };

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
  // false suppresses every editor-only affordance added on top of the base diagram (pan/zoom,
  // grid backdrop, dimension lines) so a future non-interactive embedding renders the same bare
  // window graphic WindowDiagram.tsx produces. Defaults to true because the only current caller
  // (app/page.tsx's live "Diseño" tab) is fully interactive.
  interactive?: boolean;
  activeTool?: Tool;
  onPartClick: (id: string, part: PartKind, side: SideKey | null, e: MouseEvent<HTMLButtonElement>) => void;
  onAssemblyMarcoClick: (side: SideKey) => void;
  onCentralLockClick: (id: string) => void;
  onZoomChange?: (scale: number) => void;
};

export const FrameCanvas = forwardRef<FrameCanvasHandle, Props>(function FrameCanvas(
  {
    tree,
    width,
    height,
    selectedId,
    color,
    focusScope,
    focusPart,
    focusSide,
    showFocus = true,
    interactive = true,
    activeTool,
    onPartClick,
    onAssemblyMarcoClick,
    onCentralLockClick,
    onZoomChange,
  },
  ref
) {
  const light = color.name === "Blanco";
  const panZoom = usePanZoom(interactive, onZoomChange);

  useImperativeHandle(
    ref,
    () => ({ zoomIn: panZoom.zoomIn, zoomOut: panZoom.zoomOut, fit: panZoom.fitToView, resetZoom: panZoom.reset }),
    [panZoom]
  );

  const diagram = (
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
      {interactive && <DimensionOverlay widthMm={width} heightMm={height} />}
    </div>
  );

  if (!interactive) return diagram;

  const toolClass = activeTool ? `tool-${activeTool.mode}` : "tool-select";

  return (
    <div
      className={`canvasViewport ${toolClass} ${panZoom.isPanning ? "isPanning" : ""}`}
      ref={panZoom.containerRef}
      onPointerDown={panZoom.onPointerDown}
      onPointerMove={panZoom.onPointerMove}
      onPointerUp={panZoom.onPointerUp}
      onPointerLeave={panZoom.onPointerLeave}
    >
      <div
        className="zoomLayer"
        style={{ transform: `translate(${panZoom.x}px, ${panZoom.y}px) scale(${panZoom.scale})` }}
      >
        {diagram}
      </div>
    </div>
  );
});
