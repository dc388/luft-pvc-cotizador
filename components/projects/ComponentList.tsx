"use client";

import { useMemo, useState } from "react";
import { catalog } from "@/data/catalog";
import { colors } from "@/data/colors";
import { glassCatalog } from "@/data/glass";
import { money } from "@/lib/money";
import type { ComponentSummary, ProjectSummary } from "@/types/project";

/**
 * Los componentes del proyecto abierto: la lista desde la que se selecciona, se edita y se opera.
 *
 * Cada fila dice todo lo que hace falta para decidir sin abrirla -- tipología, sistema y marca,
 * medidas, cantidad, color, vidrio, en qué estado va su configuración, precio por pieza y subtotal,
 * y cuándo se creó y se modificó. Los nombres de sistema, color y vidrio se resuelven aquí contra el
 * catálogo real a partir de los índices que trae el resumen, así que no hay que cargar la
 * configuración completa de cada componente para poder pintar la lista.
 *
 * Cuál está activo se marca de tres formas a la vez (fondo, barra lateral y `aria-current`) porque es
 * la pregunta que la interfaz nunca debe dejar ambigua: lo que se ve en el dibujo, en propiedades y
 * en el resumen de costos es ESTE componente.
 */

const CONFIG_LABEL: Record<ComponentSummary["configState"], string> = {
  pendiente: "Sin verificar",
  ok: "Configuración correcta",
  alertas: "Con alertas",
};

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function longDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-MX", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Los índices vienen de la base y el catálogo puede haber cambiado de tamaño entre versiones, así
 *  que se acotan en vez de confiar en ellos: un índice fuera de rango daría `undefined.name`. */
function systemName(component: ComponentSummary): string {
  const systems = catalog[component.brand] ?? [];
  return systems[Math.min(component.systemIndex, systems.length - 1)]?.name ?? "Sistema desconocido";
}

function colorName(component: ComponentSummary): string {
  const palette = colors[component.brand] ?? [];
  return palette[Math.min(component.colorIndex, palette.length - 1)]?.name ?? "—";
}

function glassName(component: ComponentSummary): string {
  return glassCatalog[Math.min(component.glassIndex, glassCatalog.length - 1)]?.name ?? "—";
}

export type BulkAction = "duplicate" | "delete" | "export" | "move" | "copy";

type Props = {
  components: ComponentSummary[];
  activeComponentId: string | null;
  /** Proyectos a los que se puede mover o copiar. El actual se excluye al pintar el selector. */
  projects: ProjectSummary[];
  currentProjectId: string | null;
  busy: boolean;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, designation: string) => void;
  onChangeQty: (id: string, qty: number) => void;
  onDelete: (component: ComponentSummary) => void;
  onBulk: (action: BulkAction, ids: string[], targetProjectId?: string) => void;
};

export function ComponentList({
  components,
  activeComponentId,
  projects,
  currentProjectId,
  busy,
  readOnly,
  onSelect,
  onAdd,
  onDuplicate,
  onRename,
  onChangeQty,
  onDelete,
  onBulk,
}: Props) {
  const [marked, setMarked] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [target, setTarget] = useState("");

  // La selección efectiva se DERIVA de lo marcado y de lo que existe, en vez de limpiarse con un
  // efecto: los componentes marcados pueden haber desaparecido (se borraron, se movieron a otro
  // proyecto, o se cambió de proyecto) y una acción masiva no debe enviar ids fantasma. Derivarlo
  // también evita el render extra que costaba corregir el estado después de cada cambio de lista.
  const selected = useMemo(() => {
    const present = new Set(components.map((component) => component.id));
    return marked.filter((id) => present.has(id));
  }, [components, marked]);

  const others = projects.filter((project) => project.id !== currentProjectId && !project.deletedAt);
  const allSelected = components.length > 0 && selected.length === components.length;

  function toggle(id: string) {
    setMarked((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  function commitRename() {
    if (!renaming) return;
    const value = renaming.value.trim();
    const current = components.find((component) => component.id === renaming.id);
    if (value && current && value !== current.designation) onRename(renaming.id, value);
    setRenaming(null);
  }

  function runBulk(action: BulkAction) {
    if (selected.length === 0) return;
    if ((action === "move" || action === "copy") && !target) return;
    onBulk(action, selected, action === "move" || action === "copy" ? target : undefined);
    // Mover y borrar dejan la selección sin sentido; copiar y exportar la conservan para poder
    // repetir la operación hacia otro destino.
    if (action === "move" || action === "delete") setMarked([]);
  }

  if (components.length === 0) {
    return (
      <div className="componentEmpty">
        <p>Este proyecto todavía no tiene componentes. Cada componente es una ventana o puerta independiente.</p>
        <button type="button" className="fullButton" onClick={onAdd} disabled={busy || readOnly}>
          + Agregar el primer componente
        </button>
      </div>
    );
  }

  return (
    <div className="componentManager">
      <div className="componentListHead">
        <label className="componentSelectAll">
          <input
            type="checkbox"
            checked={allSelected}
            // Marca de "algunos seleccionados": el estado real de la selección parcial, que un
            // checkbox binario no puede mostrar por su cuenta.
            ref={(node) => {
              if (node) node.indeterminate = selected.length > 0 && !allSelected;
            }}
            onChange={(event) => setMarked(event.target.checked ? components.map((component) => component.id) : [])}
          />
          {selected.length > 0 ? `${selected.length} seleccionado(s)` : "Seleccionar todos"}
        </label>
        <span className="componentListCount">
          {components.length} {components.length === 1 ? "componente" : "componentes"} ·{" "}
          {components.reduce((sum, component) => sum + component.qty, 0)} piezas
        </span>
      </div>

      {selected.length > 0 && (
        <div className="componentBulkBar" role="group" aria-label="Acciones sobre los componentes seleccionados">
          <button type="button" onClick={() => runBulk("duplicate")} disabled={busy || readOnly}>Duplicar</button>
          <button type="button" onClick={() => runBulk("export")} disabled={busy}>Exportar</button>
          <div className="componentBulkMove">
            <label>
              <span className="visuallyHidden">Proyecto de destino</span>
              <select value={target} onChange={(event) => setTarget(event.target.value)} disabled={others.length === 0}>
                <option value="">{others.length === 0 ? "No hay otro proyecto" : "Mover o copiar a…"}</option>
                {others.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}{project.folio ? ` · ${project.folio}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => runBulk("move")} disabled={busy || readOnly || !target}>Mover</button>
            <button type="button" onClick={() => runBulk("copy")} disabled={busy || readOnly || !target}>Copiar</button>
          </div>
          <button type="button" className="explorerDanger" onClick={() => runBulk("delete")} disabled={busy || readOnly}>
            Eliminar
          </button>
        </div>
      )}

      <ul className="componentList">
        {components.map((component) => {
          const active = component.id === activeComponentId;
          const isRenaming = renaming?.id === component.id;
          return (
            <li key={component.id} className={`componentItem ${active ? "isActive" : ""}`}>
              <label className="componentCheck">
                <span className="visuallyHidden">Seleccionar {component.designation}</span>
                <input type="checkbox" checked={selected.includes(component.id)} onChange={() => toggle(component.id)} />
              </label>

              <div className="componentBody">
                <button
                  type="button"
                  className="componentOpen"
                  onClick={() => onSelect(component.id)}
                  aria-current={active ? "true" : undefined}
                  title="Abrir este componente en el editor"
                >
                  {isRenaming ? (
                    <input
                      className="componentRenameInput"
                      autoFocus
                      value={renaming.value}
                      onChange={(event) => setRenaming({ id: component.id, value: event.target.value })}
                      onBlur={commitRename}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename();
                        if (event.key === "Escape") setRenaming(null);
                      }}
                      // El clic dentro del campo no debe abrir el componente.
                      onClick={(event) => event.stopPropagation()}
                    />
                  ) : (
                    <b>
                      {component.code} · {component.designation}
                      {active && <span className="componentActiveTag">En edición</span>}
                    </b>
                  )}
                  <span className="componentSpecs">
                    {component.typology || "Tipología sin registrar"} · {component.brand} {systemName(component)}
                  </span>
                  <span className="componentSpecs">
                    {component.widthMm}×{component.heightMm} mm · {colorName(component)} · {glassName(component)}
                    {component.location ? ` · ${component.location}` : ""}
                  </span>
                  <span className="componentFigures">
                    <span className={`componentState state-${component.configState}`}>{CONFIG_LABEL[component.configState]}</span>
                    <span>{component.unitPrice > 0 ? `${money(component.unitPrice)} / pza.` : "Sin precio"}</span>
                    <b>{component.total > 0 ? money(component.total) : "—"}</b>
                  </span>
                  <span className="componentDates">
                    <span title={`Creado ${longDate(component.createdAt)}`}>Creado {shortDate(component.createdAt)}</span>
                    <span title={`Modificado ${longDate(component.updatedAt)}`}>Modificado {shortDate(component.updatedAt)}</span>
                  </span>
                </button>

                <div className="componentQty">
                  <label>
                    Cant.
                    <input
                      type="number"
                      min={1}
                      value={component.qty}
                      disabled={readOnly}
                      onChange={(event) => {
                        const qty = Number(event.target.value);
                        if (Number.isFinite(qty) && qty >= 1) onChangeQty(component.id, Math.round(qty));
                      }}
                    />
                  </label>
                </div>
              </div>

              <details className="componentMenu">
                <summary title="Acciones del componente" aria-label={`Acciones de ${component.designation}`}>⋯</summary>
                <div className="componentMenuBody">
                  <button type="button" onClick={() => onSelect(component.id)}>Abrir</button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setRenaming({ id: component.id, value: component.designation })}
                  >
                    Cambiar nombre
                  </button>
                  <button type="button" disabled={readOnly} onClick={() => onDuplicate(component.id)}>Duplicar</button>
                  <button type="button" onClick={() => onBulk("export", [component.id])}>Exportar</button>
                  <button
                    type="button"
                    className="explorerDanger"
                    disabled={readOnly || components.length <= 1}
                    title={components.length <= 1 ? "Un proyecto conserva al menos un componente" : undefined}
                    onClick={() => onDelete(component)}
                  >
                    Eliminar
                  </button>
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      <button type="button" className="fullButton" onClick={onAdd} disabled={busy || readOnly}>
        + Agregar componente
      </button>
    </div>
  );
}
