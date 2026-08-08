"use client";

import { FitViewIcon, ZoomInIcon, ZoomOutIcon } from "./icons";

type Props = {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onResetZoom: () => void;
};

// Figma/CAD-style zoom cluster pinned over the 2D canvas: current zoom %, +/-, a plain
// reset-to-100%, and a real "zoom to fit"/"zoom extents" (AutoCAD/Fusion 360/SketchUp all have
// one) that scales the drawing to fill the viewport instead of just snapping back to 100% --
// those used to be the exact same handler wired to two differently-labeled buttons, so "Ajustar
// a la vista" (fit to view) didn't actually fit anything wider/taller than the pane. This is the
// visible half of the pan/zoom feature added to FrameCanvas — the canvas itself owns the actual
// scale/offset state (via usePanZoom) and is driven through the FrameCanvasHandle ref, so this
// component stays a dumb control strip.
export function CanvasZoomControls({ scale, onZoomIn, onZoomOut, onFit, onResetZoom }: Props) {
  return (
    <div className="zoomControls" role="group" aria-label="Zoom del lienzo">
      <button type="button" title="Alejar" aria-label="Alejar" onClick={onZoomOut}>
        <ZoomOutIcon />
      </button>
      <button type="button" className="zoomPct" title="Restablecer zoom a 100%" onClick={onResetZoom}>
        {Math.round(scale * 100)}%
      </button>
      <button type="button" title="Acercar" aria-label="Acercar" onClick={onZoomIn}>
        <ZoomInIcon />
      </button>
      <span className="zoomDivider" />
      <button type="button" title="Ajustar el dibujo a la vista" aria-label="Ajustar el dibujo a la vista" onClick={onFit}>
        <FitViewIcon />
      </button>
    </div>
  );
}
