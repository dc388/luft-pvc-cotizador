"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

// Fluid pan (drag) + zoom (wheel / trackpad pinch) for the 2D design canvas, modeled on how
// Figma/CAD viewports behave: wheel zooms toward the cursor, drag pans, and a couple of
// affordances (middle-click drag, space+drag) let you pan even while the pointer is over the
// window's own hit buttons without stealing their clicks — plain left-drag only pans when it
// starts on empty canvas backdrop, so clicking a marco/hoja/vidrio hit zone is never at risk of
// being swallowed by a pan gesture.
const MIN_SCALE = 0.35;
const MAX_SCALE = 5;

export type PanZoomState = { scale: number; x: number; y: number };

export function usePanZoom(enabled: boolean, onScaleChange?: (scale: number) => void) {
  const [state, setState] = useState<PanZoomState>({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const spaceRef = useRef(false);

  useEffect(() => {
    onScaleChange?.(state.scale);
  }, [state.scale, onScaleChange]);

  useEffect(() => {
    if (!enabled) return;
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = true;
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [enabled]);

  const clamp = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number) => {
    setState((prev) => {
      const next = clamp(prev.scale * factor);
      if (Math.abs(next - prev.scale) < 0.0001) return prev;
      const el = containerRef.current;
      if (el && clientX != null && clientY != null) {
        const rect = el.getBoundingClientRect();
        const cx = clientX - rect.left - rect.width / 2;
        const cy = clientY - rect.top - rect.height / 2;
        const k = next / prev.scale;
        return { scale: next, x: cx - (cx - prev.x) * k, y: cy - (cy - prev.y) * k };
      }
      return { ...prev, scale: next };
    });
  }, []);

  const zoomIn = useCallback(() => zoomAt(1.25), [zoomAt]);
  const zoomOut = useCallback(() => zoomAt(1 / 1.25), [zoomAt]);
  const reset = useCallback(() => setState({ scale: 1, x: 0, y: 0 }), []);

  // Native (non-passive) wheel listener so preventDefault reliably stops page/trackpad scroll —
  // React's onWheel prop is passive by default and can't guarantee that.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0016);
      zoomAt(factor, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [enabled, zoomAt]);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (!enabled) return;
    const target = e.target as HTMLElement;
    const onWindow = !!target.closest(".window");
    const middle = e.button === 1;
    const spacePan = spaceRef.current && e.button === 0;
    const emptyDrag = e.button === 0 && !onWindow;
    if (!middle && !spacePan && !emptyDrag) return;
    e.preventDefault();
    setIsPanning(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: stateRef.current.x, origY: stateRef.current.y };
    // Best-effort: pointer capture just guarantees pointermove/up keep firing even if the
    // cursor leaves the viewport mid-drag. Some environments reject capture for a given
    // pointerId (e.g. it's not currently "active") -- that's not fatal to panning, which still
    // works via normal bubbling, so swallow it rather than let it abort the gesture.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // ignore -- see comment above
    }
  }, [enabled]);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    // Snapshot the ref into locals right here rather than re-reading dragRef.current inside the
    // setState updater below: React can defer/batch that updater's execution, and a fast
    // drag-then-release can null the ref (via endPan) before the updater actually runs, which
    // used to throw "Cannot read properties of null (reading 'origX')".
    const drag = dragRef.current;
    if (!drag) return;
    const nx = drag.origX + (e.clientX - drag.startX);
    const ny = drag.origY + (e.clientY - drag.startY);
    setState((prev) => ({ ...prev, x: nx, y: ny }));
  }, []);

  const endPan = useCallback(() => {
    dragRef.current = null;
    setIsPanning(false);
  }, []);

  return {
    containerRef,
    scale: state.scale,
    x: state.x,
    y: state.y,
    isPanning,
    zoomIn,
    zoomOut,
    reset,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPan,
    onPointerLeave: endPan,
  };
}
