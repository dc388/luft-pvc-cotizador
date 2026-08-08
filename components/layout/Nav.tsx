"use client";

import type { SelfCheckResult } from "@/lib/selfCheck";

type TopBarProps = {
  code: string;
  designation: string;
  location: string;
  onPrint: () => void;
  selfCheck: SelfCheckResult | null;
  /** ISO timestamp of the last successful autosave to localStorage, or null before the first one. */
  savedAt: string | null;
};

export function TopBar({ code, designation, location, onPrint, selfCheck, savedAt }: TopBarProps) {
  const sc = selfCheck ?? { ok: true, checks: [] };
  const scTitle = sc.checks.map((c) => `${c.pass ? "✓" : "✗"} ${c.name}`).join("\n");
  const savedLabel = savedAt
    ? `Guardado ${new Date(savedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`
    : "Sin guardar";
  return (
    <header className="topbar">
      <a className="brand" href="#top">
        <span className="brandMark">L</span>
        <span>LUFT <b>PVC</b></span>
      </a>
      <div className="projectName">
        <span>PROYECTO ACTIVO</span>
        <strong>Oferta {code} · {designation} {location}</strong>
      </div>
      <div className="headerActions">
        <span className={`selfCheckBadge ${savedAt ? "ok" : "warn"}`} title="Autoguardado en este navegador">{savedLabel}</span>
        <span className={`selfCheckBadge ${sc.ok ? "ok" : "warn"}`} title={scTitle}>{sc.ok ? "✓ Sistema OK" : "⚠ Revisar"}</span>
        <button className="primary" onClick={onPrint}>Generar informe</button>
      </div>
    </header>
  );
}

type ModuleNavProps<T extends string> = { tabs: T[]; active: T; onChange: (tab: T) => void };

export function ModuleNav<T extends string>({ tabs, active, onChange }: ModuleNavProps<T>) {
  return (
    <nav className="moduleNav">
      {tabs.map((x) => (
        <button key={x} className={active === x ? "active" : ""} onClick={() => onChange(x)}>{x}</button>
      ))}
    </nav>
  );
}
