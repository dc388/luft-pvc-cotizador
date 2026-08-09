"use client";

import { typologyDefs, type TypologyDef } from "@/data/typologies";

type Props = { onApply: (t: TypologyDef) => void };

// Biblioteca de tipologías: elegir una reemplaza el árbol de composición completo con una
// estructura real (ver data/typologies.ts) -- no es una imagen de referencia, es el mismo
// resultado que se obtendría armándolo a mano con el Toolbox.
export function TypologyPicker({ onApply }: Props) {
  return (
    <div className="typologyGrid">
      {typologyDefs.map((t) => (
        <button key={t.id} type="button" className="typologyButton" title={t.description} onClick={() => onApply(t)}>
          <span className="typologyIcon">{t.icon}</span>
          <span className="typologyName">{t.name}</span>
        </button>
      ))}
    </div>
  );
}
