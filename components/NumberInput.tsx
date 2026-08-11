"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
};

// Plain `<input type="number" value={n} onChange={(e) => setN(Math.max(1, Number(e.target.value)))} />`
// fights the user mid-edit: the instant a backspace-to-retype empties the field, `Number("")` (or
// the min clamp) snaps the controlled value back to 0/1 before they type the next digit, so the new
// digit lands next to that stray "0"/"1" instead of replacing it -- "can't type continuously".
// This keeps the DOM text as its own local state while focused (so an empty/partial field is never
// force-corrected mid-keystroke), commits every syntactically valid number live so calculations
// still update as you type, and only clamps/repairs the final value on blur.
export function NumberInput({ value, onChange, min, ...rest }: Props) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  return (
    <input
      type="number"
      {...rest}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => {
        const n = Number(text);
        const clamped = Number.isFinite(n) ? (min != null ? Math.max(min, n) : n) : value;
        setText(String(clamped));
        if (clamped !== value) onChange(clamped);
      }}
    />
  );
}
