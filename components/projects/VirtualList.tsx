"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Lista con ventana deslizante: solo monta las filas que caben en pantalla.
 *
 * Sustituye al "Mostrar más" por lotes, que dejaba el problema a medias -- con seiscientos proyectos y
 * el botón pulsado unas cuantas veces, el navegador acababa con seiscientas filas montadas igual.
 *
 * Cómo funciona: el contenedor tiene una altura fija y hace scroll; dentro, un espaciador da la altura
 * total (filas × alto de fila) y solo se renderizan las filas del tramo visible más un margen. La
 * posición se consigue desplazando el bloque de filas, no posicionando cada una.
 *
 * Por qué alto de fila fijo y no medido: las filas de proyecto tienen todas la misma estructura, así
 * que un alto uniforme es cierto y hace la cuenta exacta. Medir cada fila costaría un ResizeObserver
 * por fila para resolver un problema que aquí no existe.
 *
 * Por debajo del umbral no virtualiza nada: montar veinte filas es más barato que llevar la cuenta, y
 * así la lista corta conserva su alto natural en vez de un contenedor con scroll propio.
 */

type Props<T> = {
  items: T[];
  /** Alto de cada fila en píxeles, incluida la separación entre filas. */
  rowHeight: number;
  /** Alto máximo del área con scroll. */
  maxHeight: number;
  /** Filas extra que se montan arriba y abajo del tramo visible, para que al desplazar no se vea el
   *  hueco antes de que aparezca la fila. */
  overscan?: number;
  /** Por debajo de esta cantidad de filas no se virtualiza. */
  threshold?: number;
  keyOf: (item: T) => string;
  children: (item: T) => ReactNode;
  /** Clase de la lista, para conservar los estilos de la lista original. */
  className?: string;
  ariaLabel?: string;
};

export function VirtualList<T>({
  items,
  rowHeight,
  maxHeight,
  overscan = 6,
  threshold = 24,
  keyOf,
  children,
  className,
  ariaLabel,
}: Props<T>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(maxHeight);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height) setViewportHeight(height);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  if (items.length < threshold) {
    return (
      <ul className={className} aria-label={ariaLabel}>
        {items.map((item) => (
          <li key={keyOf(item)} className="virtualRow">
            {children(item)}
          </li>
        ))}
      </ul>
    );
  }

  const total = items.length * rowHeight;
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const last = Math.min(items.length, first + visibleCount);
  const slice = items.slice(first, last);

  return (
    <div
      ref={viewportRef}
      className="virtualViewport"
      style={{ maxHeight }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      {/* El espaciador da el alto real de la lista completa, así que la barra de scroll y la posición
          del pulgar corresponden al total de proyectos y no a lo que está montado. */}
      <div style={{ height: total, position: "relative" }}>
        <ul
          className={className}
          aria-label={ariaLabel}
          style={{ position: "absolute", top: first * rowHeight, left: 0, right: 0 }}
        >
          {slice.map((item) => (
            <li key={keyOf(item)} className="virtualRow" style={{ height: rowHeight }}>
              {children(item)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
