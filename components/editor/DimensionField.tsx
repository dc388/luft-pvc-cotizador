"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  min: number;
  onCommit: (n: number) => void;
};

// A plain numeric field backed by a local text draft instead of being bound straight to
// numeric state. The previous <input type="number" value={n} onChange={...}> forced every
// keystroke -- including a cleared field -- through Number(x)||0, snapping "" to 0 mid-edit
// and pushing a full calc/2D/3D recompute on every digit (see app/Workspace.tsx's Ancho/
// Alto/Cant.). Here nothing external changes until blur/Enter: the user can freely clear and
// retype without the value fighting back, invalid/incomplete input reverts to the last valid
// number instead of becoming 0/NaN, and the app only re-renders once editing is done. Mirrors
// the commit-on-blur/Enter, revert-on-Escape pattern EditableDim already uses for the
// on-canvas W=/H= labels.
export function DimensionField({ value, min, onCommit }: Props) {
  const [draft, setDraft] = useState(String(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(parsed)) {
      setDraft(String(value)); // incomplete/invalid -- keep the last valid geometry
      return;
    }
    const clamped = Math.max(min, Math.round(parsed));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "" || /^[0-9]{1,6}$/.test(v)) setDraft(v);
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
