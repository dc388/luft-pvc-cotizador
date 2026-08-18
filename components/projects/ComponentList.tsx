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
 *
 * AGRUPACIÓN POR UBICACIÓN
 * Un proyecto de obra no es una lista plana: "Torre B" son siete ventanas repartidas entre niveles y
 * departamentos, y quien cotiza necesita ver y operar por bloque, no recorrer treinta filas seguidas.
 * La lista se agrupa por el campo `location` que ya existe en cada componente, con subtotal de piezas
 * e importe por grupo, y con una casilla que selecciona el bloque completo -- que es lo que vuelve
 * usable "mover todo el piso 3 a otro proyecto".
 *
 * Deliberadamente NO es una jerarquía de carpetas: no hay tabla nueva ni migración, y un proyecto que
 * no use ubicaciones se pinta exactamente como antes. El agrupado aparece solo cuando hay más de una
 * ubicación distinta, así que la pantalla no cambia para quien no lo necesita.
 */

const CONFIG_LABEL: Record<ComponentSummary["configState"], string> = {
  pendiente: "Sin verificar",
  ok: "Configuración correcta",
  alertas: "Con alertas",
};

/** Los componentes sin ubicación se juntan bajo un nombre propio en vez de desaparecer del listado. */
const SIN_UBICACION = "Sin ubicación";

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

/** Qué campo se está editando en línea. Nombre y ubicación usan el mismo mecanismo porque son la
 *  misma interacción: escribir un texto corto sobre la fila sin abrir el componente. */
type EditField = "designation" | "location";

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
  /** Cambia la ubicación sin abrir el componente: es lo que permite armar y rehacer los grupos. */
  onSetLocation: (id: string, location: string) => void;
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
  onSetLocation,
  onChangeQty,
  onDelete,
  onBulk,
}: Props) {
  const [marked, setMarked] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; field: EditField; value: string } | null>(null);
  const [target, setTarget] = useState("");

  // La selección efectiva se DERIVA de lo marcado y de lo que existe, en vez de limpiarse con un
  // efecto: los componentes marcados pueden haber desaparecido (se borraron, se movieron a otro
  // proyecto, o se cambió de proyecto) y una acción masiva no debe enviar ids fantasma. Derivarlo
  // también evita el render extra que costaba corregir el estado después de cada cambio de lista.
  const selected = useMemo(() => {
    const present = new Set(components.map((component) => component.id));
    return marked.filter((id) => present.has(id));
  }, [components, marked]);

  // Los grupos salen en el orden en que aparece cada ubicación por primera vez, que es el orden de
  // `position` que el usuario ya controla -- no alfabético, que reordenaría la obra sin pedirlo.
  const groups = useMemo(() => {
    const byLocation = new Map<string, ComponentSummary[]>();
    for (const component of components) {
      const key = component.location.trim() || SIN_UBICACION;
      const list = byLocation.get(key);
      if (list) list.push(component);
      else byLocation.set(key, [component]);
    }
    return [...byLocation.entries()].map(([name, items]) => ({
      name,
      items,
      pieces: items.reduce((sum, component) => sum + component.qty, 0),
      total: items.reduce((sum, component) => sum + component.total, 0),
    }));
  }, [components]);

  const grouped = groups.length > 1;
  const others = projects.filter((project) => project.id !== currentProjectId && !project.deletedAt);
  const allSelected = components.length > 0 && selected.length === components.length;

  function toggle(id: string) {
    setMarked((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  /** Marca o desmarca un bloque entero. Es la mitad que le faltaba a "mover el piso 3 completo". */
  function toggleGroup(ids: string[], select: boolean) {
    setMarked((current) => {
      if (select) return [...new Set([...current, ...ids])];
      const drop = new Set(ids);
      return current.filter((id) => !drop.has(id));
    });
  }

  function commitEdit() {
    if (!editing) return;
    const value = editing.value.trim();
    const current = components.find((component) => component.id === editing.id);
    if (current) {
      // El nombre no se puede vaciar; la ubicación sí, y vaciarla devuelve el componente al grupo
      // "Sin ubicación", que es la forma natural de sacarlo de un bloque.
      if (editing.field === "designation") {
        if (value && value !== current.designation) onRename(editing.id, value);
      } else if (value !== current.location.trim()) {
        onSetLocation(editing.id, value);
      }
    }
    setEditing(null);
  }

  function runBulk(action: BulkAction) {
    if (selected.length === 0) return;
    if ((action === "move" || action === "copy") && !target) return;
    onBulk(action, selected, action === "move" || action === "copy" ? target : undefined);
    // Mover y borrar dejan la selección sin sentido; copiar y exportar la conservan para poder
    // repetir la operación hacia otro destino.
    if (action === "move" || action === "delete") setMarked([]);
  }

  function renderRow(component: ComponentSummary) {
    const active = component.id === activeComponentId;
    const edit = editing?.id === component.id ? editing : null;
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
            {edit?.field === "designation" ? (
              <input
                className="componentRenameInput"
                autoFocus
                value={edit.value}
                onChange={(event) => setEditing({ id: component.id, field: "designation", value: event.target.value })}
                onBlur={commitEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitEdit();
                  if (event.key === "Escape") setEditing(null);
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
              {/* Cuando la lista ya está agrupada, repetir la ubicación en cada fila es ruido: el
                  encabezado del bloque ya la dice. */}
              {!grouped && component.location ? ` · ${component.location}` : ""}
            </span>
            {edit?.field === "location" && (
              <input
                className="componentRenameInput"
                autoFocus
                placeholder="Ubicación (p. ej. Torre B · Piso 3)"
                value={edit.value}
                onChange={(event) => setEditing({ id: component.id, field: "location", value: event.target.value })}
                onBlur={commitEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitEdit();
                  if (event.key === "Escape") setEditing(null);
                }}
                onClick={(event) => event.stopPropagation()}
              />
            )}
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
              onClick={() => setEditing({ id: component.id, field: "designation", value: component.designation })}
            >
              Cambiar nombre
            </button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setEditing({ id: component.id, field: "location", value: component.location })}
            >
              Cambiar ubicación
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
          {grouped ? ` · ${groups.length} ubicaciones` : ""}
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

      {grouped ? (
        groups.map((group) => {
          const ids = group.items.map((component) => component.id);
          const allInGroup = ids.every((id) => selected.includes(id));
          const someInGroup = !allInGroup && ids.some((id) => selected.includes(id));
          return (
            <details key={group.name} className="componentGroup" open>
              <summary className="componentGroupHead">
                {/* El clic en la casilla selecciona el bloque; no debe además plegarlo. */}
                <label className="componentCheck" onClick={(event) => event.stopPropagation()}>
                  <span className="visuallyHidden">Seleccionar todo en {group.name}</span>
                  <input
                    type="checkbox"
                    checked={allInGroup}
                    ref={(node) => {
                      if (node) node.indeterminate = someInGroup;
                    }}
                    onChange={(event) => toggleGroup(ids, event.target.checked)}
                  />
                </label>
                <b className="componentGroupName">{group.name}</b>
                <span className="componentGroupMeta">
                  {group.items.length} {group.items.length === 1 ? "componente" : "componentes"} · {group.pieces}{" "}
                  {group.pieces === 1 ? "pza" : "pzas"}
                </span>
                <span className="componentGroupTotal">{group.total > 0 ? money(group.total) : "—"}</span>
              </summary>
              <ul className="componentList">{group.items.map(renderRow)}</ul>
            </details>
          );
        })
      ) : (
        <ul className="componentList">{components.map(renderRow)}</ul>
      )}

      <button type="button" className="fullButton" onClick={onAdd} disabled={busy || readOnly}>
        + Agregar componente
      </button>
    </div>
  );
}
