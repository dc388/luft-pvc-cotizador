"use client";

import { FitViewIcon, ZoomInIcon, ZoomOutIcon } from "./icons";

type Props = {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
};

// Figma/CAD-style zoom cluster pinned over the 2D canvas: current zoom %, +/-, and a "fit to
// view" reset. This is the visible half of the pan/zoom feature added to FrameCanvas — the
// canvas itself owns the actual scale/offset state (via usePanZoom) and is driven through the
// FrameCanvasHandle ref, so this component stays a dumb control strip.
export function CanvasZoomControls({ scale, onZoomIn, onZoomOut, onFit }: Props) {
  return (
    <div className="zoomControls" role="group" aria-label="Zoom del lienzo">
      <button type="button" title="Alejar" aria-label="Alejar" onClick={onZoomOut}>
        <ZoomOutIcon />
      </button>
      <button type="button" className="zoomPct" title="Restablecer zoom y centrar" onClick={onFit}>
        {Math.round(scale * 100)}%
      </button>
      <button type="button" title="Acercar" aria-label="Acercar" onClick={onZoomIn}>
        <ZoomInIcon />
      </button>
      <span className="zoomDivider" />
      <button type="button" title="Ajustar a la vista" aria-label="Ajustar a la vista" onClick={onFit}>
        <FitViewIcon />
      </button>
    </div>
  );
}
