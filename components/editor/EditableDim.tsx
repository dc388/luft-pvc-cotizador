"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  label: string;
  valueMm: number;
  min: number;
  onCommit: (mm: number) => void;
};

// A cota (W=/H= label drawn on the canvas) that becomes an editable numeric field on click,
// matching the in-place dimension editing seen in the reference video (click the drawn
// dimension, type a new value, confirm -- no need to go back to the sidebar's width/height
// inputs). Escape reverts without committing; blur/Enter commits, clamped to the same
// MIN_OPENING_MM floor the sidebar inputs already enforce.
export function EditableDim({ label, valueMm, min, onCommit }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(valueMm));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    setDraft(String(valueMm));
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const n = Math.max(min, Math.round(Number(draft) || 0));
    if (n !== valueMm) onCommit(n);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        className="dimLabel"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <button type="button" className="dimLabel" onClick={() => setEditing(true)} title="Clic para editar la medida">
      {label}={valueMm.toLocaleString()} mm
    </button>
  );
}
