"use client";

import type { CSSProperties } from "react";
import type { PartKind } from "./frameTypes";

/**
 * Leyenda de la alzada: qué es cada franja del dibujo.
 *
 * Sobre la escala, que es la parte fácil de exagerar: los anchos de las franjas se calculan a
 * escala real (ver lib/elevation.ts), pero a tamaño de pantalla casi siempre caen en su mínimo de
 * legibilidad -- un perfil de 15 mm en una ventana de 1800 dibujada a 242 px mide 2 px. El dibujo
 * sirve para ver la ESTRUCTURA y para seleccionar piezas; las medidas se leen escritas, en la
 * cadena de cotas y en la etiqueta de cada hoja. Por eso las notas de aquí no prometen escala.
 *
 * Los seis componentes de una ventana se dibujaban todos del color del folio con una diferencia de
 * brillo mínima, así que no había forma de saber qué se estaba mirando ni qué se acababa de
 * seleccionar. Distinguirlos por tono (ver las capas en app/globals.css) resuelve la mitad; la otra
 * mitad es decir cómo se llama cada tono, que es lo que hace esto.
 *
 * La entrada que corresponde a la pieza seleccionada se marca, así que la leyenda también sirve de
 * confirmación: pulsas una franja del dibujo y ves aquí qué pieza es.
 */

type KeyItem = {
  label: string;
  /** Con qué parte del modelo se corresponde, para marcarla al seleccionar. */
  part: PartKind | null;
  swatch: string;
  note?: string;
};

const ITEMS: KeyItem[] = [
  { label: "Marco", part: "marco", swatch: "keyMarco" },
  { label: "Hoja", part: "hoja", swatch: "keyHoja" },
  // El junquillo no tiene parte propia en el modelo: se selecciona con el vidrio, porque es la
  // pieza que lo sujeta y en la lista de corte va atada a él.
  { label: "Junquillo", part: "vidrio", swatch: "keyJunquillo", note: "ancho indicativo, no es una medida" },
  { label: "Vidrio", part: "vidrio", swatch: "keyVidrio", note: "su medida va escrita en la hoja" },
  { label: "Riel", part: null, swatch: "keyRiel" },
  { label: "Manija", part: "herraje", swatch: "keyManija" },
];

export function ElevationKey({
  focusPart,
  hasRail,
  /** El color del folio elegido: las muestras se derivan de el, igual que las capas del dibujo,
   *  para que la leyenda no pueda estar diciendo un tono distinto del que se esta pintando. */
  frameHex,
}: {
  focusPart: PartKind | null;
  hasRail: boolean;
  frameHex: string;
}) {
  return (
    <div className="elevationKey" style={{ "--frame-actual": frameHex } as CSSProperties} aria-label="Componentes del dibujo">
      {ITEMS.filter((i) => i.swatch !== "keyRiel" || hasRail).map((item) => (
        <span
          key={item.label}
          className={`keyItem ${item.part !== null && item.part === focusPart ? "keyItemActive" : ""}`}
          title={item.note ? `${item.label} — ${item.note}` : item.label}
        >
          <i className={`keySwatch ${item.swatch}`} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}
