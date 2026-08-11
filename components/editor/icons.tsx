// Hand-authored inline SVG icon set for the design canvas (editor toolbox, canvas hit markers,
// zoom controls, view switcher, 3D viewer chrome). Replaces every unicode-glyph icon that used
// to live in Toolbox.tsx/FrameNodeView.tsx/CentralLocks.tsx — no icon package dependency, so
// there's nothing new to justify in the bundle. Every icon uses stroke="currentColor" (or a
// currentColor fill for tiny solid glyphs) so it inherits whatever color the surrounding button
// sets, exactly like the glyphs it replaces did.
"use client";

import type { ReactNode } from "react";
import type { WingType } from "@/types/domain";

export type IconProps = { size?: number; className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ size = 16, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} aria-hidden="true" focusable="false" className={className} {...base}>
      {children}
    </svg>
  );
}

const FRAME = <rect x="3" y="3" width="18" height="18" rx="1.6" />;

// ---------- Wing / opening-type pictograms (Toolbox "Tipo de hoja" + canvas motion glyph) ----------
export function WingIcon({ id, size = 18, className }: IconProps & { id: WingType }) {
  switch (id) {
    case "fixed":
      return <Svg size={size} className={className}>{FRAME}</Svg>;
    case "sliding":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <line x1="6.5" y1="12" x2="17.5" y2="12" />
          <path d="M9 9 6.3 12 9 15" />
          <path d="M15 9 17.7 12 15 15" />
        </Svg>
      );
    case "lift-slide":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <line x1="6" y1="14" x2="18" y2="14" />
          <path d="M15 11.5 18 14 15 16.5" />
          <path d="M9.3 9 11.5 6.6 13.7 9" />
        </Svg>
      );
    case "folding-sliding":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <path d="M6 12 9 8 12 16 15 8 18 12" />
        </Svg>
      );
    case "sliding-fixed":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <line x1="12" y1="6" x2="12" y2="18" />
          <line x1="14.5" y1="12" x2="18.5" y2="12" />
          <path d="M16.7 10 18.7 12 16.7 14" />
        </Svg>
      );
    case "casement-in":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <line x1="5.4" y1="5" x2="5.4" y2="9" />
          <line x1="5.4" y1="15" x2="5.4" y2="19" />
          <path d="M17.2 8 9 12 17.2 16" />
        </Svg>
      );
    case "casement-out":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <line x1="18.6" y1="5" x2="18.6" y2="9" />
          <line x1="18.6" y1="15" x2="18.6" y2="19" />
          <path d="M6.8 8 15 12 6.8 16" />
        </Svg>
      );
    case "tilt-turn":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <path d="M8 17 8 8.5 16 8.5" />
          <path d="M13 6 16 8.5 13 11" />
        </Svg>
      );
    case "project":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <line x1="5.5" y1="6.2" x2="18.5" y2="6.2" />
          <path d="M6.5 8.4 12 15.4 17.5 8.4" />
        </Svg>
      );
    case "hopper":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <line x1="5.5" y1="17.8" x2="18.5" y2="17.8" />
          <path d="M6.5 15.6 12 8.6 17.5 15.6" />
        </Svg>
      );
    case "jalousie":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <line x1="6" y1="7.5" x2="18" y2="7.5" />
          <line x1="6" y1="11" x2="18" y2="11" />
          <line x1="6" y1="14.5" x2="18" y2="14.5" />
          <line x1="6" y1="18" x2="18" y2="18" />
        </Svg>
      );
    case "pivot":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <line x1="12" y1="5" x2="12" y2="19" />
          <path d="M8.6 8a5.4 5.4 0 0 0 0 8" />
          <path d="M7.6 14.6 8.6 17 10.6 15.8" />
        </Svg>
      );
    case "door":
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <line x1="6.5" y1="4" x2="6.5" y2="20" />
          <path d="M6.5 20a13.5 13.5 0 0 0 11-16" />
          <circle cx="15.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
        </Svg>
      );
    case "inactive":
    default:
      return (
        <Svg size={size} className={className}>
          {FRAME}
          <line x1="8.5" y1="12" x2="15.5" y2="12" />
        </Svg>
      );
  }
}

// ---------- Motion arrow used inside a sliding leaf's own hoja hit zone ----------
export function MotionArrowIcon({ direction, size = 22, className }: IconProps & { direction: string }) {
  const flip = direction === "Izquierda";
  return (
    <Svg size={size} className={className}>
      <line x1={flip ? 18 : 6} y1="12" x2={flip ? 7.2 : 16.8} y2="12" />
      <path d={flip ? "M10 8 6.5 12 10 16" : "M14 8 17.5 12 14 16"} />
    </Svg>
  );
}

// ---------- Divider / split tool icons ----------
export function SplitColsIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      {FRAME}
      <line x1="12" y1="3" x2="12" y2="21" />
    </Svg>
  );
}
export function SplitRowsIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      {FRAME}
      <line x1="3" y1="12" x2="21" y2="12" />
    </Svg>
  );
}

// ---------- Hardware / hit-marker icons ----------
export function HandleIcon({ size = 13, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="10.5" cy="13.5" r="3.1" />
      <path d="M12.7 11.3 19 5" />
      <path d="M16.4 5 19 5 19 7.6" />
    </Svg>
  );
}
export function LockIcon({ size = 13, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="6" y="11" width="12" height="9" rx="1.6" />
      <path d="M8.4 11V8a3.6 3.6 0 0 1 7.2 0v3" />
    </Svg>
  );
}

// ---------- Toolbox action icons ----------
export function SelectToolIcon({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path d="M6 3.5 18.5 13l-5.6 1.2 2.6 5.3-2 1-2.6-5.3L6.9 19Z" fill="currentColor" stroke="currentColor" strokeWidth={0.6} strokeLinejoin="round" />
    </svg>
  );
}
export function MergeIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="6.5" width="7" height="11" rx="1.2" />
      <rect x="14" y="6.5" width="7" height="11" rx="1.2" />
      <line x1="10.4" y1="12" x2="13.6" y2="12" />
      <path d="M12 10 13.6 12 12 14" />
    </Svg>
  );
}
export function ResetIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 12a7 7 0 1 0 2.2-5.1" />
      <path d="M5 6.2V11h4.8" />
    </Svg>
  );
}

// ---------- Zoom / view controls ----------
export function ZoomInIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="10.4" cy="10.4" r="6.4" />
      <line x1="15" y1="15" x2="20" y2="20" />
      <line x1="10.4" y1="7.6" x2="10.4" y2="13.2" />
      <line x1="7.6" y1="10.4" x2="13.2" y2="10.4" />
    </Svg>
  );
}
export function ZoomOutIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="10.4" cy="10.4" r="6.4" />
      <line x1="15" y1="15" x2="20" y2="20" />
      <line x1="7.6" y1="10.4" x2="13.2" y2="10.4" />
    </Svg>
  );
}
export function FitViewIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 9V4.5H8.5" />
      <path d="M20 9V4.5H15.5" />
      <path d="M4 15V19.5H8.5" />
      <path d="M20 15V19.5H15.5" />
    </Svg>
  );
}

// ---------- View-switch (2D/3D/Sección) + 3D preset icons ----------
export function View2DIcon({ size = 13, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="1.4" />
    </Svg>
  );
}
export function View3DIcon({ size = 13, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 3 20 7.3v9.4L12 21 4 16.7V7.3Z" />
      <path d="M12 12 20 7.3M12 12v9M12 12 4 7.3" />
    </Svg>
  );
}
export function ViewSectionIcon({ size = 13, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="4" y="6" width="16" height="12" rx="1.4" />
      <line x1="12" y1="4" x2="12" y2="20" strokeDasharray="2.2 2.2" />
    </Svg>
  );
}
export function PresetFrontIcon({ size = 13, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="5" y="5" width="14" height="14" rx="1.2" />
    </Svg>
  );
}
export function PresetPlanIcon({ size = 13, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="4.5" y="8" width="15" height="11" rx="1.2" />
      <path d="M12 8V2.6" />
      <path d="M10.4 4.2 12 2.4 13.6 4.2" />
    </Svg>
  );
}
export function PresetProfileIcon({ size = 13, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="9" y="4" width="6" height="16" rx="1.2" />
    </Svg>
  );
}
export function PresetIsoIcon({ size = 13, className }: IconProps) {
  return <View3DIcon size={size} className={className} />;
}
