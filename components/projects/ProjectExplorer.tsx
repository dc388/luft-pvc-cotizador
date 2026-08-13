"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createLocalStore } from "@/lib/localStore";
import { money } from "@/lib/money";
import { VirtualList } from "./VirtualList";
import { PROJECT_STATUSES, projectStatusLabel } from "@/lib/projectStatus";
import type { ProjectStatus, ProjectSummary } from "@/types/project";

/**
 * El explorador de proyectos.
 *
 * Dos categorías reales y no decorativas: los proyectos que entraron desde fuera (un archivo, un
 * respaldo, o una cotización que un cliente envió por el cotizador público) y los que se crearon
 * aquí. La categoría sale de la columna `origin` del proyecto, así que sobrevive a renombrarlo y es
 * la misma en cualquier navegador -- no es un agrupamiento que esta pantalla se invente al pintar.
 *
 * La papelera es una tercera vista, nunca mezclada: lo borrado no debe aparecer junto a lo vivo.
 *
 * Todo el filtrado y el ordenamiento ocurren aquí, sobre la lista ya resuelta, y no en la base. Es
 * deliberado: la lista se pide una vez y luego se recorre, se busca y se reordena sin una petición
 * por tecla. El resumen que llega por proyecto (cliente, empresa, teléfono, correo, importe,
 * componentes) trae exactamente los campos por los que se puede buscar y ordenar, para que no haya
 * que abrir cada proyecto para poder filtrarlo.
 */

type SortKey = "recientes" | "antiguos" | "modificados" | "nombre" | "importe" | "componentes";
type Visibility = "activos" | "archivados" | "todos" | "papelera";
type DateField = "createdAt" | "updatedAt";

const SORT_LABEL: Record<SortKey, string> = {
  recientes: "Más recientes",
  antiguos: "Más antiguos",
  modificados: "Última modificación",
  nombre: "Nombre",
  importe: "Importe",
  componentes: "Número de componentes",
};

const VISIBILITY_LABEL: Record<Visibility, string> = {
  activos: "Activos",
  archivados: "Archivados",
  todos: "Todos",
  papelera: "Papelera",
};

// La lista se virtualiza: solo se montan las filas visibles, así que da igual si hay veinte proyectos
// o dos mil. Las filas tienen alto uniforme porque todas llevan la misma información (nombre, folio,
// solicitante, cifras, insignias y fechas), y ese alto se fija también en CSS para que la cuenta de la
// ventana y lo que se pinta no se puedan separar. Ver components/projects/VirtualList.tsx.
const ROW_HEIGHT = 140;
const LIST_MAX_HEIGHT = 560;
const TRASH_ROW_HEIGHT = 116;

/** Preferencias de la pantalla (categoría abierta, visibilidad, orden). Se recuerdan porque son de
 *  quien trabaja, no del proyecto: volver y encontrar la lista como la dejaste es parte de poder
 *  usarla todos los días. */
const PREFS_KEY = "luft-pvc-cotizador:explorer-prefs:v1";

type Prefs = {
  visibility: Visibility;
  sort: SortKey;
  openPlatform: boolean;
  openImported: boolean;
};

const DEFAULT_PREFS: Prefs = { visibility: "activos", sort: "recientes", openPlatform: true, openImported: true };

function normalizePrefs(raw: unknown): Prefs {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as Partial<Prefs>;
  return {
    visibility: parsed.visibility && parsed.visibility in VISIBILITY_LABEL ? parsed.visibility : DEFAULT_PREFS.visibility,
    sort: parsed.sort && parsed.sort in SORT_LABEL ? parsed.sort : DEFAULT_PREFS.sort,
    openPlatform: parsed.openPlatform !== false,
    openImported: parsed.openImported !== false,
  };
}

const prefsStore = createLocalStore<Prefs>(PREFS_KEY, DEFAULT_PREFS, normalizePrefs);

function dateLabel(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function matchesQuery(project: ProjectSummary, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  // El teléfono se compara además solo con dígitos: quien busca escribe "9932211158" y el guardado
  // puede ser "993 221 1158".
  const digits = needle.replace(/\D/g, "");
  const phoneDigits = project.phone.replace(/\D/g, "");
  return (
    project.name.toLowerCase().includes(needle) ||
    project.folio.toLowerCase().includes(needle) ||
    project.client.toLowerCase().includes(needle) ||
    project.company.toLowerCase().includes(needle) ||
    project.email.toLowerCase().includes(needle) ||
    project.phone.toLowerCase().includes(needle) ||
    (digits.length >= 3 && phoneDigits.includes(digits))
  );
}

export type ProjectExplorerActions = {
  onOpen: (id: string) => void;
  onCreate: () => void;
  onRename: (project: ProjectSummary) => void;
  onEditInfo: (project: ProjectSummary) => void;
  onDuplicate: (project: ProjectSummary) => void;
  onExport: (project: ProjectSummary) => void;
  onArchive: (project: ProjectSummary, archived: boolean) => void;
  onDelete: (project: ProjectSummary) => void;
  onRestore: (project: ProjectSummary) => void;
  onPurge: (project: ProjectSummary) => void;
  onImportFile: (file: File) => void;
  onBackup: () => void;
  onRestoreBackup: (file: File) => void;
};

type Props = ProjectExplorerActions & {
  projects: ProjectSummary[];
  trashed: ProjectSummary[];
  activeProjectId: string | null;
  busy: boolean;
  offline: boolean;
  error: string;
  /** Se llama cuando la vista pasa a la papelera, para que quien manda la pida si no la tiene. */
  onNeedTrash: () => void;
};

export function ProjectExplorer({
  projects,
  trashed,
  activeProjectId,
  busy,
  offline,
  error,
  onNeedTrash,
  onOpen,
  onCreate,
  onRename,
  onEditInfo,
  onDuplicate,
  onExport,
  onArchive,
  onDelete,
  onRestore,
  onPurge,
  onImportFile,
  onBackup,
  onRestoreBackup,
}: Props) {
  // Las preferencias viven en localStorage y se leen como estado externo: así no hace falta un efecto
  // que las cargue al montar (un render extra en cada carga) y además la lista reacciona si se
  // cambian desde otra pestaña. Ver lib/localStore.ts.
  const prefs = useSyncExternalStore(prefsStore.subscribe, prefsStore.getSnapshot, prefsStore.getServerSnapshot);
  const setPrefs = prefsStore.set;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [client, setClient] = useState("");
  const [dateField, setDateField] = useState<DateField>("createdAt");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefs.visibility === "papelera") onNeedTrash();
    // onNeedTrash es estable en el llamador; incluirlo aquí volvería a pedir la papelera en cada
    // render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.visibility]);

  const inTrash = prefs.visibility === "papelera";
  const source = inTrash ? trashed : projects;

  const clients = useMemo(
    () => [...new Set(source.map((project) => project.client).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [source]
  );

  const filtered = useMemo(() => {
    const fromTime = from ? Date.parse(`${from}T00:00:00`) : null;
    // El "hasta" incluye el día completo: quien filtra "hasta el 12" espera ver lo del día 12.
    const toTime = to ? Date.parse(`${to}T23:59:59.999`) : null;

    return source.filter((project) => {
      if (!inTrash) {
        if (prefs.visibility === "activos" && project.archivedAt) return false;
        if (prefs.visibility === "archivados" && !project.archivedAt) return false;
      }
      if (status && project.status !== status) return false;
      if (client && project.client !== client) return false;
      if (!matchesQuery(project, query.trim())) return false;
      const stamp = Date.parse(project[dateField]);
      if (fromTime !== null && Number.isFinite(stamp) && stamp < fromTime) return false;
      if (toTime !== null && Number.isFinite(stamp) && stamp > toTime) return false;
      return true;
    });
  }, [source, inTrash, prefs.visibility, status, client, query, dateField, from, to]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const time = (iso: string) => {
      const parsed = Date.parse(iso);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    copy.sort((a, b) => {
      switch (prefs.sort) {
        case "antiguos":
          return time(a.createdAt) - time(b.createdAt);
        case "modificados":
          return time(b.updatedAt) - time(a.updatedAt);
        case "nombre":
          return a.name.localeCompare(b.name, "es-MX");
        case "importe":
          return b.total - a.total;
        case "componentes":
          return b.componentCount - a.componentCount;
        default:
          return time(b.createdAt) - time(a.createdAt);
      }
    });
    return copy;
  }, [filtered, prefs.sort]);

  const groups = useMemo(
    () => ({
      imported: sorted.filter((project) => project.origin === "imported"),
      platform: sorted.filter((project) => project.origin === "platform"),
    }),
    [sorted]
  );

  const filtersActive = !!(query.trim() || status || client || from || to);
  const totalShown = sorted.length;

  function clearFilters() {
    setQuery("");
    setStatus("");
    setClient("");
    setFrom("");
    setTo("");
  }

  return (
    <div className="projectExplorer">
      <div className="explorerToolbar">
        <button type="button" className="explorerPrimary" onClick={onCreate} disabled={busy || offline}>
          + Nuevo proyecto
        </button>
        <button
          type="button"
          onClick={() => importInput.current?.click()}
          disabled={busy || offline}
          title="Abrir un proyecto guardado como archivo (.luftproj)"
        >
          Importar archivo
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".luftproj,.json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            // El valor se limpia para que elegir el MISMO archivo dos veces vuelva a disparar el
            // evento: sin esto, reintentar tras un error no hace nada.
            event.target.value = "";
            if (file) onImportFile(file);
          }}
        />
      </div>

      <div className="explorerSearch">
        <label className="explorerSearchField">
          <span className="visuallyHidden">Buscar proyecto</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, folio, cliente, empresa, correo o teléfono"
          />
        </label>
        <button
          type="button"
          className={`explorerFilterToggle ${filtersActive ? "hasFilters" : ""}`}
          aria-expanded={showFilters}
          onClick={() => setShowFilters((open) => !open)}
          title="Filtros y ordenamiento"
        >
          Filtros{filtersActive ? " ·" : ""}
        </button>
      </div>

      {showFilters && (
        <div className="explorerFilters">
          <label>
            Mostrar
            <select
              value={prefs.visibility}
              onChange={(event) => setPrefs({ ...prefs, visibility: event.target.value as Visibility })}
            >
              {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((option) => (
                <option key={option} value={option}>{VISIBILITY_LABEL[option]}</option>
              ))}
            </select>
          </label>
          <label>
            Ordenar por
            <select value={prefs.sort} onChange={(event) => setPrefs({ ...prefs, sort: event.target.value as SortKey })}>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((option) => (
                <option key={option} value={option}>{SORT_LABEL[option]}</option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus | "")}>
              <option value="">Todos</option>
              {PROJECT_STATUSES.map((option) => (
                <option key={option} value={option}>{projectStatusLabel(option)}</option>
              ))}
            </select>
          </label>
          <label>
            Solicitante
            <select value={client} onChange={(event) => setClient(event.target.value)}>
              <option value="">Todos</option>
              {clients.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Filtrar fechas por
            <select value={dateField} onChange={(event) => setDateField(event.target.value as DateField)}>
              <option value="createdAt">Fecha de creación</option>
              <option value="updatedAt">Fecha de modificación</option>
            </select>
          </label>
          <div className="explorerFilterRange">
            <label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label>Hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          </div>
          {filtersActive && (
            <button type="button" className="explorerClearFilters" onClick={clearFilters}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {error && <p className="explorerError" role="alert">⚠ {error}</p>}
      {offline && (
        <p className="explorerNotice">
          ⚠ Sin conexión con la base de datos. La lista de proyectos y el guardado en servidor no están
          disponibles; lo que edites se guarda solo en este navegador.
        </p>
      )}

      {inTrash ? (
        <TrashList projects={sorted} busy={busy} onRestore={onRestore} onPurge={onPurge} />
      ) : (
        <>
          <ProjectGroup
            title="Importados"
            hint="Proyectos que entraron desde un archivo, un respaldo o el cotizador público."
            projects={groups.imported}
            open={prefs.openImported}
            onToggle={() => setPrefs({ ...prefs, openImported: !prefs.openImported })}
            activeProjectId={activeProjectId}
            busy={busy}
            actions={{ onOpen, onRename, onEditInfo, onDuplicate, onExport, onArchive, onDelete }}
          />
          <ProjectGroup
            title="Creados en la plataforma"
            hint="Proyectos que se abrieron aquí dentro."
            projects={groups.platform}
            open={prefs.openPlatform}
            onToggle={() => setPrefs({ ...prefs, openPlatform: !prefs.openPlatform })}
            activeProjectId={activeProjectId}
            busy={busy}
            actions={{ onOpen, onRename, onEditInfo, onDuplicate, onExport, onArchive, onDelete }}
          />

          {totalShown === 0 && (
            <div className="explorerEmpty">
              {filtersActive || prefs.visibility !== "activos" ? (
                <>
                  <p>Ningún proyecto coincide con lo que buscas.</p>
                  <button type="button" onClick={clearFilters}>Limpiar filtros</button>
                </>
              ) : offline ? (
                <p>Sin conexión con la base de datos: la lista no está disponible.</p>
              ) : (
                <>
                  <p>Todavía no hay proyectos. Crea el primero o abre uno que tengas guardado como archivo.</p>
                  <div className="explorerEmptyActions">
                    <button type="button" onClick={onCreate} disabled={busy}>+ Nuevo proyecto</button>
                    <button type="button" onClick={() => importInput.current?.click()} disabled={busy}>
                      Importar archivo
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      <div className="explorerBackup">
        <button type="button" onClick={onBackup} disabled={busy || offline} title="Descarga todos los proyectos en un solo archivo">
          Crear copia de seguridad
        </button>
        <button type="button" onClick={() => backupInput.current?.click()} disabled={busy || offline}>
          Restaurar copia
        </button>
        <input
          ref={backupInput}
          type="file"
          accept=".luftbak,.json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onRestoreBackup(file);
          }}
        />
        <small>Restaurar AGREGA los proyectos de la copia; nunca reemplaza lo que ya tienes aquí.</small>
      </div>
    </div>
  );
}

type GroupActions = Pick<
  ProjectExplorerActions,
  "onOpen" | "onRename" | "onEditInfo" | "onDuplicate" | "onExport" | "onArchive" | "onDelete"
>;

function ProjectGroup({
  title,
  hint,
  projects,
  open,
  onToggle,
  activeProjectId,
  busy,
  actions,
}: {
  title: string;
  hint: string;
  projects: ProjectSummary[];
  open: boolean;
  onToggle: () => void;
  activeProjectId: string | null;
  busy: boolean;
  actions: GroupActions;
}) {
  return (
    <section className="explorerGroup">
      <button type="button" className="explorerGroupHead" aria-expanded={open} onClick={onToggle}>
        <i aria-hidden="true">{open ? "▾" : "▸"}</i>
        <b>{title}</b>
        <span className="explorerGroupCount">{projects.length}</span>
      </button>
      {open && (
        <>
          <p className="explorerGroupHint">{hint}</p>
          {projects.length === 0 ? (
            <p className="explorerGroupEmpty">Sin proyectos en esta categoría.</p>
          ) : (
            <VirtualList
              items={projects}
              rowHeight={ROW_HEIGHT}
              maxHeight={LIST_MAX_HEIGHT}
              keyOf={(project) => project.id}
              className="explorerList"
              ariaLabel={title}
            >
              {(project) => (
                <ProjectRow project={project} active={project.id === activeProjectId} busy={busy} actions={actions} />
              )}
            </VirtualList>
          )}
        </>
      )}
    </section>
  );
}

function ProjectRow({
  project,
  active,
  busy,
  actions,
}: {
  project: ProjectSummary;
  active: boolean;
  busy: boolean;
  actions: GroupActions;
}) {
  return (
    <div className={`explorerRow ${active ? "isActive" : ""} ${project.archivedAt ? "isArchived" : ""}`}>
      <button
        type="button"
        className="explorerRowMain"
        onClick={() => actions.onOpen(project.id)}
        disabled={busy}
        aria-current={active ? "true" : undefined}
      >
        <span className="explorerRowTop">
          <b>{project.name}</b>
          <em className="explorerRowFolio">{project.folio || "Sin folio"}</em>
        </span>
        <span className="explorerRowClient">{project.client || "Sin solicitante"}{project.company ? ` · ${project.company}` : ""}</span>
        <span className="explorerRowFigures">
          <span>{project.componentCount} {project.componentCount === 1 ? "componente" : "componentes"}</span>
          <span>{project.pieceCount} {project.pieceCount === 1 ? "pieza" : "piezas"}</span>
          <b>{project.total > 0 ? money(project.total) : "Sin cotizar"}</b>
        </span>
        <span className="explorerRowMeta">
          <span className={`explorerBadge status-${project.status}`}>{projectStatusLabel(project.status)}</span>
          <span className={`explorerBadge origin-${project.origin}`}>
            {project.origin === "imported" ? "Importado" : "Creado aquí"}
          </span>
          {project.source === "web" && <span className="explorerBadge origin-web" title="Llegó del cotizador público">WEB</span>}
          {project.archivedAt && <span className="explorerBadge isArchivedBadge">Archivado</span>}
        </span>
        <span className="explorerRowDates">
          {/* Las tres fechas dicen cosas distintas y las tres se piden: cuándo se creó, cuándo se
              tocó por última vez y -- si vino de fuera -- cuándo entró aquí y cuándo se creó
              originalmente. */}
          <span title={`Creado ${dateLabel(project.createdAt)}`}>Creado {shortDate(project.createdAt)}</span>
          <span title={`Modificado ${dateLabel(project.updatedAt)}`}>Modificado {shortDate(project.updatedAt)}</span>
          {project.importedAt && (
            <span title={`Importado ${dateLabel(project.importedAt)}`}>Importado {shortDate(project.importedAt)}</span>
          )}
          {project.originalCreatedAt && project.originalCreatedAt !== project.createdAt && (
            <span title={`Fecha de creación original ${dateLabel(project.originalCreatedAt)}`}>
              Original {shortDate(project.originalCreatedAt)}
            </span>
          )}
        </span>
      </button>

      {/* <details> como menú: se abre y se cierra con teclado sin una línea de JavaScript, y no
          atrapa el foco. */}
      <details className="explorerRowMenu">
        <summary title="Acciones del proyecto" aria-label={`Acciones de ${project.name}`}>⋯</summary>
        <div className="explorerRowMenuBody">
          <button type="button" onClick={() => actions.onOpen(project.id)}>Abrir</button>
          <button type="button" onClick={() => actions.onEditInfo(project)}>Editar información</button>
          <button type="button" onClick={() => actions.onRename(project)}>Cambiar nombre</button>
          <button type="button" onClick={() => actions.onDuplicate(project)}>Duplicar</button>
          <button type="button" onClick={() => actions.onExport(project)}>Exportar a archivo</button>
          <button type="button" onClick={() => actions.onArchive(project, !project.archivedAt)}>
            {project.archivedAt ? "Desarchivar" : "Archivar"}
          </button>
          <button type="button" className="explorerDanger" onClick={() => actions.onDelete(project)}>Eliminar</button>
        </div>
      </details>
    </div>
  );
}

function TrashList({
  projects,
  busy,
  onRestore,
  onPurge,
}: {
  projects: ProjectSummary[];
  busy: boolean;
  onRestore: (project: ProjectSummary) => void;
  onPurge: (project: ProjectSummary) => void;
}) {
  if (projects.length === 0) {
    return <p className="explorerGroupEmpty">La papelera está vacía.</p>;
  }
  return (
    <section className="explorerGroup">
      <p className="explorerGroupHint">
        Los proyectos borrados se conservan aquí con todos sus componentes hasta que los elimines
        definitivamente.
      </p>
      <VirtualList
        items={projects}
        rowHeight={TRASH_ROW_HEIGHT}
        maxHeight={LIST_MAX_HEIGHT}
        keyOf={(project) => project.id}
        className="explorerList"
        ariaLabel="Papelera"
      >
        {(project) => (
          <div className="explorerRow isTrashed">
            <div className="explorerRowMain asStatic">
              <span className="explorerRowTop">
                <b>{project.name}</b>
                <em className="explorerRowFolio">{project.folio || "Sin folio"}</em>
              </span>
              <span className="explorerRowClient">{project.client || "Sin solicitante"}</span>
              <span className="explorerRowFigures">
                <span>{project.componentCount} {project.componentCount === 1 ? "componente" : "componentes"}</span>
                <b>{project.total > 0 ? money(project.total) : "Sin cotizar"}</b>
              </span>
              <span className="explorerRowDates">
                <span title={`Borrado ${dateLabel(project.deletedAt)}`}>Borrado {shortDate(project.deletedAt)}</span>
              </span>
            </div>
            <div className="explorerTrashActions">
              <button type="button" onClick={() => onRestore(project)} disabled={busy}>Restaurar</button>
              <button type="button" className="explorerDanger" onClick={() => onPurge(project)} disabled={busy}>
                Eliminar definitivamente
              </button>
            </div>
          </div>
        )}
      </VirtualList>
    </section>
  );
}
