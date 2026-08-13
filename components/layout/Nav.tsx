"use client";

import type { SaveState } from "@/lib/persistence";
import type { SelfCheckResult } from "@/lib/selfCheck";

type TopBarProps = {
  code: string;
  designation: string;
  location: string;
  /** Nombre del proyecto abierto, para que el encabezado no deje dudas de en qué se está trabajando. */
  projectName: string;
  onPrint: () => void;
  selfCheck: SelfCheckResult | null;
  /** ISO del último guardado CONFIRMADO, o null si todavía no hay ninguno. */
  savedAt: string | null;
  saveState: SaveState;
  saveError: string;
};

/** Etiqueta, tono y explicación de cada estado del guardado.
 *
 *  La regla que ordena todo esto: "Guardado" solo aparece cuando el servidor confirmó. Antes la
 *  insignia se calculaba de `savedAt`, así que un guardado fallido dejaba en pantalla la hora del
 *  último éxito -- la interfaz decía "Guardado 11:00" mientras nada se guardaba. */
function saveBadge(saveState: SaveState, savedAt: string | null, saveError: string) {
  const hour = savedAt ? new Date(savedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "";
  switch (saveState) {
    case "saving":
      return { tone: "busy", label: "Guardando…", title: "Enviando los cambios al servidor." };
    case "pending":
      return { tone: "busy", label: "Cambios pendientes", title: "Hay cambios sin guardar; se guardan en cuanto dejes de escribir." };
    case "saved":
      return { tone: "ok", label: `Guardado ${hour}`, title: "El servidor confirmó el guardado." };
    case "error":
      return {
        tone: "error",
        label: "Error al guardar",
        title: saveError || "El último intento de guardado falló. Tu trabajo sigue en pantalla y en el borrador local.",
      };
    case "locked":
      return {
        tone: "warn",
        label: "Abierto en otra pestaña",
        title: "Otra pestaña tiene abierto este componente. No se está guardando desde aquí para no sobrescribirla.",
      };
    default:
      return savedAt
        ? { tone: "ok", label: `Guardado ${hour}`, title: "Sin cambios desde el último guardado." }
        : { tone: "warn", label: "Sin guardar", title: "Todavía no se ha guardado nada de este componente." };
  }
}

export function TopBar({ code, designation, location, projectName, onPrint, selfCheck, savedAt, saveState, saveError }: TopBarProps) {
  const sc = selfCheck ?? { ok: true, checks: [] };
  const scTitle = sc.checks.map((c) => `${c.pass ? "✓" : "✗"} ${c.name}`).join("\n");
  const badge = saveBadge(saveState, savedAt, saveError);
  return (
    <header className="topbar">
      <a className="brand" href="#top">
        <span className="brandMark">L</span>
        <span>LUFT <b>PVC</b></span>
      </a>
      <div className="projectName">
        <span>{projectName || "PROYECTO ACTIVO"}</span>
        <strong>Oferta {code} · {designation} {location}</strong>
      </div>
      <div className="headerActions">
        <span className={`selfCheckBadge save-${badge.tone}`} title={badge.title} aria-live="polite">
          {badge.label}
        </span>
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
