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

// Margen que el dibujo deja libre dentro del lienzo, y es simétrico porque el dibujo va centrado:
// reservar de más por un solo lado no lo correría, solo lo encogería. Los valores salen de las
// cotas generales, que se dibujan sobre el lienzo y no deben quedar encima del producto
// (.dim.side arranca en left:42px y su etiqueta girada ocupa hasta ~66px; .dim.top en top:40px).
const FIT_INSET_X = 76;
const FIT_INSET_Y = 58;
// Por debajo de esto no hay lienzo real que medir (primer render, panel plegado): se deja que el
// CSS aplique su valor de reserva en vez de fijar un tamaño absurdo.
const MIN_FIT_PX = 80;

/** El rectángulo más grande con proporción `aspect` que cabe en el lienzo, sin deformarlo. */
function fitBox(containerWidth: number, containerHeight: number, aspect: number) {
  const availableWidth = containerWidth - FIT_INSET_X * 2;
  const availableHeight = containerHeight - FIT_INSET_Y * 2;
  if (!(aspect > 0) || availableWidth < MIN_FIT_PX || availableHeight < MIN_FIT_PX) return null;
  const width = Math.min(availableWidth, availableHeight * aspect);
  return { width, height: width / aspect };
}

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
  /** Proporción real del producto (ancho/alto en mm) para ajustarlo al lienzo sin deformarlo. */
  aspect: number;
};

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function PanZoomViewport({ children, onBackgroundClick, aspect }: PanZoomViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const spacePressedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

  // El lienzo se mide en vez de suponerse: es un panel elástico entre dos columnas que además
  // cambian de tamaño con la ventana del navegador y con el nivel de zoom de la página, así que
  // cualquier tope en píxeles fijos deja de corresponder al espacio real disponible.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setContainerSize((prev) =>
        prev && Math.abs(prev.width - rect.width) < 1 && Math.abs(prev.height - rect.height) < 1
          ? prev
          : { width: rect.width, height: rect.height }
      );
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const fit = containerSize ? fitBox(containerSize.width, containerSize.height, aspect) : null;

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
  // --fit-w/--fit-h las consume .modelStage (app/globals.css). Cuando todavía no hay medida se
  // omiten y el CSS aplica su valor de reserva.
  const stageStyle = {
    "--viewport-grid-size": `${28 * viewport.scale}px`,
    "--viewport-pan-x": `${viewport.x}px`,
    "--viewport-pan-y": `${viewport.y}px`,
    ...(fit ? { "--fit-w": `${fit.width}px`, "--fit-h": `${fit.height}px` } : {}),
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
