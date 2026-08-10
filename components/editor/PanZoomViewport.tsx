"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.15;

type Viewport = {
  x: number;
  y: number;
  scale: number;
};

type Drag = {
  pointerId: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
};

type PanZoomViewportProps = {
  children: ReactNode;
  onBackgroundClick: () => void;
};

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function PanZoomViewport({ children, onBackgroundClick }: PanZoomViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const spacePressedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);

  const setScaleAround = useCallback((requestedScale: number, clientX?: number, clientY?: number) => {
    setViewport((current) => {
      const scale = clampScale(requestedScale);
      if (scale === current.scale) return current;

      const bounds = containerRef.current?.getBoundingClientRect();
      const anchorX = bounds && clientX !== undefined ? clientX - bounds.left - bounds.width / 2 : 0;
      const anchorY = bounds && clientY !== undefined ? clientY - bounds.top - bounds.height / 2 : 0;
      const ratio = scale / current.scale;

      return {
        scale,
        x: anchorX - (anchorX - current.x) * ratio,
        y: anchorY - (anchorY - current.y) * ratio,
      };
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      setViewport((current) => {
        const scale = clampScale(current.scale + direction * SCALE_STEP);
        if (scale === current.scale) return current;

        const bounds = container.getBoundingClientRect();
        const anchorX = event.clientX - bounds.left - bounds.width / 2;
        const anchorY = event.clientY - bounds.top - bounds.height / 2;
        const ratio = scale / current.scale;
        return {
          scale,
          x: anchorX - (anchorX - current.x) * ratio,
          y: anchorY - (anchorY - current.y) * ratio,
        };
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isEditableTarget(event.target)) {
        spacePressedRef.current = true;
        event.preventDefault();
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressedRef.current = false;
    };
    const handleBlur = () => {
      spacePressedRef.current = false;
      dragRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const isBackground = event.target === event.currentTarget;
    const canPan = event.button === 1
      || (event.button === 0 && (isBackground || spacePressedRef.current));
    if (!canPan) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: viewport.x,
      y: viewport.y,
    };
    suppressClickRef.current = false;
    setIsPanning(true);
  }, [viewport.x, viewport.y]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.clientX;
    const deltaY = event.clientY - drag.clientY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) suppressClickRef.current = true;
    setViewport((current) => ({ ...current, x: drag.x + deltaX, y: drag.y + deltaY }));
  }, []);

  const finishPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsPanning(false);
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }, []);

  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const reset = useCallback(() => setViewport({ x: 0, y: 0, scale: 1 }), []);
  const zoomIn = useCallback(() => setScaleAround(viewport.scale + SCALE_STEP), [setScaleAround, viewport.scale]);
  const zoomOut = useCallback(() => setScaleAround(viewport.scale - SCALE_STEP), [setScaleAround, viewport.scale]);
  const layerStyle = {
    transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
  } satisfies CSSProperties;
  const stageStyle = {
    "--viewport-grid-size": `${28 * viewport.scale}px`,
    "--viewport-pan-x": `${viewport.x}px`,
    "--viewport-pan-y": `${viewport.y}px`,
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`panZoomViewport ${isPanning ? "isPanning" : ""}`}
      style={stageStyle}
      onClickCapture={onClickCapture}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onClick={(event) => { if (event.target === event.currentTarget) onBackgroundClick(); }}
    >
      <div className="panZoomLayer" style={layerStyle}>{children}</div>
      <div className="viewportControls" aria-label="Controles de vista 2D">
        <button type="button" onClick={zoomOut} aria-label="Alejar">−</button>
        <button type="button" className="viewportScale" onClick={reset} aria-label="Restablecer zoom">
          {Math.round(viewport.scale * 100)}%
        </button>
        <button type="button" onClick={zoomIn} aria-label="Acercar">+</button>
        <button type="button" className="viewportCenter" onClick={reset}>Centrar</button>
      </div>
      <div className="viewportHint">Rueda para zoom · arrastra el fondo para mover · Espacio + arrastra sobre el modelo</div>
    </div>
  );
}
