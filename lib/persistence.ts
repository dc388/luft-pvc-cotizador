import type {
  ComponentData,
  ComponentPatch,
  ComponentRecord,
  ProjectDraft,
  ProjectMetaPatch,
  ProjectOutcome,
  ProjectRecord,
  ProjectSummary,
  ProjectVersionRow,
} from "@/types/project";
import { defaultComponentData } from "@/lib/componentDefaults";


// Fallback used only when the API/D1 is unreachable (offline, or D1 not yet provisioned in
// this environment) -- so a user mid-design never silently loses work just because the
// network request failed. Shaped like one component's fields, same idea as the old
// single-design PersistedProject this replaces.
const OFFLINE_KEY = "luft-pvc-cotizador:offline-component:v1";

type OfflineComponent = {
  code: string; designation: string; location: string; qty: number;
  widthMm: number; heightMm: number; brand: string; systemIndex: number; colorIndex: number;
  data: ComponentData; savedAt: string;
};

function readOffline(): OfflineComponent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_KEY);
    return raw ? (JSON.parse(raw) as OfflineComponent) : null;
  } catch {
    return null;
  }
}

function writeOffline(c: OfflineComponent) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OFFLINE_KEY, JSON.stringify(c));
  } catch {
    // Private-browsing quota, storage disabled, etc. -- nothing else to do from here.
  }
}

function offlineToComponentRecord(o: OfflineComponent): ComponentRecord {
  return {
    id: "offline", projectId: "offline", position: 0,
    code: o.code, designation: o.designation, location: o.location, qty: o.qty,
    widthMm: o.widthMm, heightMm: o.heightMm, brand: o.brand as ComponentRecord["brand"],
    systemIndex: o.systemIndex, colorIndex: o.colorIndex, data: o.data,
    // El respaldo sin conexión guarda la configuración, no su resumen comercial: el precio se
    // recalcula al cargarla (lo hace el editor) y la tipología también. Se dejan en su valor neutro
    // en vez de inventar un importe que nadie calculó.
    glassIndex: o.data.glassIndex, typology: "", configState: "pendiente", unitPrice: 0, total: 0,
    createdAt: o.savedAt, updatedAt: o.savedAt,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Local D1/SQLite can throw a transient "database is locked" 500 under concurrent writes
// (multiple dev servers/tabs saving at once) -- retried with a short backoff since the lock
// window is normally milliseconds, not a real outage. 4xx and other client errors never retry.
async function api<T>(url: string, init?: RequestInit, retriesLeft = 2): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (err) {
    if (retriesLeft <= 0) throw err;
    await delay(150 * 2 ** (2 - retriesLeft));
    return api<T>(url, init, retriesLeft - 1);
  }
  if (res.status >= 500 && retriesLeft > 0) {
    await delay(150 * 2 ** (2 - retriesLeft));
    return api<T>(url, init, retriesLeft - 1);
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
  return body;
}

// ---------- Borradores locales ----------

// Un borrador es la última versión de un componente que esta pestaña intentó guardar. Se escribe en
// `localStorage` ANTES de pedirle al servidor que guarde, y se borra cuando el servidor confirma. Así,
// si el navegador se cierra de golpe o la red falla justo ahí, al volver está el trabajo -- y se
// ofrece recuperarlo en vez de aplicarlo a ciegas, porque quizá lo guardado en la base es más nuevo
// (otra pestaña, otra sesión) y sobrescribirlo sin preguntar sería exactamente el fallo que esto
// intenta evitar.
const DRAFT_PREFIX = "luft-pvc-cotizador:draft:v1:";

export type ComponentDraft = { savedAt: string; patch: ComponentPatch };

function draftKey(projectId: string, componentId: string): string {
  return `${DRAFT_PREFIX}${projectId}/${componentId}`;
}

export function writeDraft(projectId: string, componentId: string, patch: ComponentPatch): void {
  if (typeof window === "undefined") return;
  try {
    const draft: ComponentDraft = { savedAt: new Date().toISOString(), patch };
    window.localStorage.setItem(draftKey(projectId, componentId), JSON.stringify(draft));
  } catch {
    // Cuota llena o almacenamiento deshabilitado: se pierde la red de seguridad, no el trabajo en
    // curso. No hay nada que informar aquí que quien edita pueda accionar.
  }
}

export function readDraft(projectId: string, componentId: string): ComponentDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(projectId, componentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ComponentDraft;
    return parsed && typeof parsed.savedAt === "string" && parsed.patch ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDraft(projectId: string, componentId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(projectId, componentId));
  } catch {
    // Nada que hacer: en el peor caso se volverá a ofrecer un borrador ya aplicado, y aplicarlo
    // otra vez es inocuo.
  }
}

/** Un borrador solo se ofrece si es MÁS NUEVO que lo guardado. Si la base tiene algo posterior, el
 *  borrador es un resto de una sesión vieja y se descarta en silencio. */
export function pendingDraftFor(component: ComponentRecord): ComponentDraft | null {
  const draft = readDraft(component.projectId, component.id);
  if (!draft) return null;
  if (Date.parse(draft.savedAt) <= Date.parse(component.updatedAt)) {
    clearDraft(component.projectId, component.id);
    return null;
  }
  return draft;
}

export type BootstrapResult = {
  project: ProjectRecord | null;
  /** `null` cuando el proyecto abierto no tiene ningún componente todavía (recién importado o
   *  llegado vacío del cotizador público). No es un error: la interfaz muestra su estado vacío. */
  component: ComponentRecord | null;
  projects: ProjectSummary[];
  mode: "db" | "offline";
};

// Runs once on mount: loads the most recently touched project + its active component from
// the DB, creating a brand-new project if none exists yet, or transparently falls back to
// the last offline-saved component if the DB isn't reachable in this environment.
// También trae la lista de carpetas para el selector de proyectos, en la misma respuesta.
export async function bootstrap(): Promise<BootstrapResult> {
  try {
    let { project, projects } = await api<{ project: ProjectRecord | null; projects?: ProjectSummary[] }>("/api/projects");
    if (!project) {
      ({ project } = await api<{ project: ProjectRecord }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      }));
      projects = undefined;
    }
    const activeId = project.activeComponentId ?? project.components[0]?.id;
    // Un proyecto sin componentes no es un fallo: se abre vacío. Antes esto lanzaba y caía al modo
    // sin conexión, que dejaba la app diciendo "sin conexión con la base" con la base sana.
    const component = activeId
      ? (await api<{ component: ComponentRecord }>(`/api/projects/${project.id}/components/${activeId}`)).component
      : null;
    return { project, component, projects: projects ?? (await listProjects().catch(() => [])), mode: "db" };
  } catch {
    const offline = readOffline();
    const component = offline ? offlineToComponentRecord(offline) : blankOfflineComponent();
    return { project: null, component, projects: [], mode: "offline" };
  }
}

/** Componente de arranque cuando no hay base ni respaldo previo: la misma ventana genérica que
 *  sembraría un proyecto nuevo, para poder empezar a diseñar sin conexión. */
function blankOfflineComponent(): ComponentRecord {
  const now = new Date().toISOString();
  const data = defaultComponentData();
  return {
    id: "offline", projectId: "offline", position: 0,
    code: "001", designation: "V01", location: "", qty: 1,
    widthMm: 4000, heightMm: 2200, brand: "Aluplast", systemIndex: 0, colorIndex: 1,
    glassIndex: data.glassIndex, typology: "", configState: "pendiente", unitPrice: 0, total: 0,
    data, createdAt: now, updatedAt: now,
  };
}

/** Crea un proyecto nuevo (con su ventana genérica) y lo devuelve listo para abrirse. */
export async function createProjectApi(draft: ProjectDraft): Promise<ProjectRecord> {
  const { project } = await api<{ project: ProjectRecord }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(draft),
  });
  return project;
}

/** La lista de proyectos del explorador, ordenada de la más reciente a la más vieja. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const { projects } = await api<{ projects?: ProjectSummary[] }>("/api/projects");
  return projects ?? [];
}

/** Los proyectos en la papelera. Nunca vienen mezclados con los demás. */
export async function listTrashedProjects(): Promise<ProjectSummary[]> {
  const { projects } = await api<{ projects?: ProjectSummary[] }>("/api/projects?scope=trash");
  return projects ?? [];
}

/** Abre otro proyecto: el proyecto completo y el componente que quedó activo dentro de él.
 *
 *  Un proyecto sin componentes SÍ se abre: los importados y los que vienen del cotizador público
 *  pueden llegar vacíos, y antes esto lanzaba y dejaba el explorador diciendo "no pudimos abrirlo"
 *  sobre un proyecto perfectamente válido. `component` viene en `null` y quien llama muestra el
 *  proyecto con su lista vacía y el botón de agregar componente. */
export async function openProject(
  projectId: string
): Promise<{ project: ProjectRecord; component: ComponentRecord | null }> {
  const project = await refetchProject(projectId);
  const activeId = project.activeComponentId ?? project.components[0]?.id;
  if (!activeId) return { project, component: null };
  const component = await fetchComponent(projectId, activeId);
  return { project, component };
}

/** Cambia metadatos del proyecto: nombre, etapa, ficha del solicitante, preferencias comerciales. */
export async function updateProjectApi(projectId: string, patch: ProjectMetaPatch): Promise<ProjectRecord> {
  const { project } = await api<{ project: ProjectRecord }>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return project;
}

export async function setProjectArchivedApi(projectId: string, archived: boolean): Promise<ProjectRecord> {
  const { project } = await api<{ project: ProjectRecord }>(`/api/projects/${projectId}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived }),
  });
  return project;
}

/** Manda el proyecto a la papelera. `purge` elimina definitivamente y no tiene vuelta atrás. */
export async function deleteProjectApi(projectId: string, opts: { purge?: boolean } = {}): Promise<void> {
  await api(`/api/projects/${projectId}${opts.purge ? "?purge=1" : ""}`, { method: "DELETE" });
}

export async function restoreProjectApi(projectId: string): Promise<ProjectRecord> {
  const { project } = await api<{ project: ProjectRecord }>(`/api/projects/${projectId}/restore`, { method: "POST" });
  return project;
}

export async function duplicateProjectApi(projectId: string, name?: string): Promise<ProjectRecord> {
  const { project } = await api<{ project: ProjectRecord }>(`/api/projects/${projectId}/duplicate`, {
    method: "POST",
    body: JSON.stringify(name ? { name } : {}),
  });
  return project;
}

export type TransferResult = { moved: number; mode: "move" | "copy"; project: ProjectRecord; targetProject: ProjectRecord };

export async function transferComponentsApi(
  projectId: string,
  componentIds: string[],
  toProjectId: string,
  mode: "move" | "copy"
): Promise<TransferResult> {
  return api<TransferResult>(`/api/projects/${projectId}/components/transfer`, {
    method: "POST",
    body: JSON.stringify({ componentIds, toProjectId, mode }),
  });
}

// ---------- Archivos ----------

/** Descarga el proyecto (o los componentes indicados) como archivo.
 *
 *  El archivo se pide al servidor y se descarga desde la respuesta en vez de construirse aquí: el
 *  navegador solo tiene cargado el componente abierto, así que armarlo del lado del cliente exigiría
 *  pedir uno por uno los demás y confiar en que ninguna petición falló. */
export async function downloadProjectFile(projectId: string, componentIds?: string[]): Promise<void> {
  const query = componentIds?.length ? `?componentIds=${componentIds.join(",")}` : "";
  const response = await fetch(`/api/projects/${projectId}/export${query}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "No se pudo exportar el proyecto.");
  }
  await saveResponseAsFile(response, "proyecto.luftproj");
}

export async function downloadBackupFile(): Promise<void> {
  const response = await fetch("/api/backup");
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "No se pudo crear la copia de seguridad.");
  }
  await saveResponseAsFile(response, "respaldo_luft.luftbak");
}

/** El nombre lo decide el servidor en `content-disposition`; el de reserva solo cubre el caso de que
 *  falte la cabecera. */
async function saveResponseAsFile(response: Response, fallbackName: string): Promise<void> {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = match?.[1] ?? fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Sin esto el blob queda retenido hasta que se descargue la pestaña. El retraso le da margen a que
  // la descarga arranque antes de invalidar el URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type ImportProbe = {
  probe: true;
  conflictedWith: string | null;
  warnings: string[];
  migratedFrom: number | null;
  name: string;
  folio: string;
  componentCount: number;
};

export type ImportOutcomeResult = {
  project: ProjectRecord;
  applied: "created" | "replaced";
  conflictedWith: string | null;
  warnings: string[];
  migratedFrom: number | null;
};

/** Pregunta al servidor si el archivo es válido y si choca con un proyecto que ya existe, sin
 *  escribir nada. Es lo que permite ofrecer "crear copia" o "reemplazar" con datos reales. */
export async function probeProjectFile(text: string): Promise<ImportProbe> {
  return api<ImportProbe>("/api/projects/import", {
    method: "POST",
    body: JSON.stringify({ file: text, probe: true }),
  });
}

export async function importProjectFileApi(text: string, mode: "copy" | "replace"): Promise<ImportOutcomeResult> {
  return api<ImportOutcomeResult>("/api/projects/import", {
    method: "POST",
    body: JSON.stringify({ file: text, mode }),
  });
}

export async function restoreBackupApi(text: string): Promise<{ restored: number; failed: string[]; warnings: string[]; projects: ProjectSummary[] }> {
  return api("/api/backup", { method: "POST", body: JSON.stringify({ file: text }) });
}

/**
 * Estados por los que pasa el autoguardado, y lo que significa cada uno:
 *
 *   idle    – nada que guardar todavía (recién cargado, sin ediciones).
 *   pending – hay cambios sin guardar; el envío está esperando a que dejes de escribir.
 *   saving  – el envío está en curso.
 *   saved   – el servidor CONFIRMÓ el guardado. Solo se llega aquí con confirmación.
 *   error   – el último intento falló. El trabajo sigue en pantalla y en el borrador local.
 *   locked  – otra pestaña tiene abierto este componente; no se guarda para no pisarla.
 */
export type SaveState = "idle" | "pending" | "saving" | "saved" | "error" | "locked";

/** Resultado de un guardado. `ok: false` es lo que permite que el indicador diga "error al guardar"
 *  en vez de "guardado": antes un fallo devolvía `savedAt: null` y la interfaz simplemente dejaba de
 *  actualizar la hora, con lo que seguía mostrando el último "Guardado 11:00" como si nada. */
export type SaveResult = {
  ok: boolean;
  savedAt: string | null;
  mode: "db" | "offline";
  error?: string;
  /** Presente cuando otra sesión guardó este componente después de la versión que se envió: trae lo
   *  que hay en el servidor, sin haber sobrescrito nada. */
  conflict?: ComponentRecord;
};

export type SaveOptions = {
  /** Fecha de modificación que esta sesión cree que tiene el componente. Ver la ruta PATCH. */
  expectedUpdatedAt?: string | null;
  /** Guardar aunque haya conflicto, después de haberlo visto. */
  force?: boolean;
};

export async function saveComponent(
  projectId: string,
  componentId: string,
  patch: ComponentPatch,
  options: SaveOptions = {}
): Promise<SaveResult> {
  if (projectId === "offline" || componentId === "offline") {
    const prev = readOffline();
    const merged: OfflineComponent = {
      code: patch.code ?? prev?.code ?? "001",
      designation: patch.designation ?? prev?.designation ?? "V01",
      location: patch.location ?? prev?.location ?? "",
      qty: patch.qty ?? prev?.qty ?? 1,
      widthMm: patch.widthMm ?? prev?.widthMm ?? 4000,
      heightMm: patch.heightMm ?? prev?.heightMm ?? 2200,
      brand: patch.brand ?? prev?.brand ?? "Aluplast",
      systemIndex: patch.systemIndex ?? prev?.systemIndex ?? 0,
      colorIndex: patch.colorIndex ?? prev?.colorIndex ?? 1,
      data: { ...(prev?.data ?? defaultComponentData()), ...(patch.data ?? {}) },
      savedAt: new Date().toISOString(),
    };
    writeOffline(merged);
    return { ok: true, savedAt: merged.savedAt, mode: "offline" };
  }
  // El conflicto se maneja aquí y no en `api()` porque hace falta el CUERPO de la respuesta 409 (la
  // versión que hay en el servidor), y `api()` solo propaga el mensaje de error.
  try {
    const response = await fetch(`/api/projects/${projectId}/components/${componentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...patch,
        ...(options.force ? { force: true } : {}),
        ...(options.expectedUpdatedAt && !options.force ? { expectedUpdatedAt: options.expectedUpdatedAt } : {}),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      component?: ComponentRecord;
      error?: string;
      conflict?: boolean;
    };

    if (response.status === 409 && body.component) {
      return { ok: false, savedAt: null, mode: "db", error: body.error, conflict: body.component };
    }
    if (!response.ok || !body.component) {
      return { ok: false, savedAt: null, mode: "db", error: body.error ?? `${response.status} ${response.statusText}` };
    }
    return { ok: true, savedAt: body.component.updatedAt, mode: "db" };
  } catch (error) {
    return {
      ok: false,
      savedAt: null,
      mode: "db",
      error: error instanceof Error ? error.message : "No se pudo guardar.",
    };
  }
}

export async function createComponent(projectId: string, opts?: { duplicateFromId?: string }): Promise<ComponentRecord> {
  const { component } = await api<{ component: ComponentRecord }>(`/api/projects/${projectId}/components`, {
    method: "POST",
    body: JSON.stringify(opts ?? {}),
  });
  return component;
}

export async function fetchComponent(projectId: string, componentId: string): Promise<ComponentRecord> {
  const { component } = await api<{ component: ComponentRecord }>(`/api/projects/${projectId}/components/${componentId}`);
  return component;
}

export async function deleteComponentApi(projectId: string, componentId: string): Promise<void> {
  await api(`/api/projects/${projectId}/components/${componentId}`, { method: "DELETE" });
}

export async function setActiveComponentApi(projectId: string, componentId: string): Promise<void> {
  await api(`/api/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ activeComponentId: componentId }) });
}

export async function renameProjectApi(projectId: string, name: string): Promise<ProjectRecord> {
  const { project } = await api<{ project: ProjectRecord }>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return project;
}

export async function refetchProject(projectId: string): Promise<ProjectRecord> {
  const { project } = await api<{ project: ProjectRecord }>(`/api/projects/${projectId}`);
  return project;
}

// ---------- Historial y cierre de obra ----------

export async function listProjectVersionsApi(projectId: string): Promise<ProjectVersionRow[]> {
  const { versions } = await api<{ versions?: ProjectVersionRow[] }>(`/api/projects/${projectId}/versions`);
  return versions ?? [];
}

export async function createProjectVersionApi(projectId: string, label: string): Promise<ProjectVersionRow[]> {
  const { versions } = await api<{ versions?: ProjectVersionRow[] }>(`/api/projects/${projectId}/versions`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
  return versions ?? [];
}

export async function restoreProjectVersionApi(
  projectId: string,
  versionId: string
): Promise<{ project: ProjectRecord; warnings: string[]; versions: ProjectVersionRow[] }> {
  return api(`/api/projects/${projectId}/versions`, {
    method: "POST",
    body: JSON.stringify({ restore: versionId }),
  });
}

export async function fetchProjectOutcome(projectId: string): Promise<ProjectOutcome | null> {
  const { outcome } = await api<{ outcome: ProjectOutcome | null }>(`/api/projects/${projectId}/outcome`);
  return outcome;
}

export async function saveProjectOutcomeApi(
  projectId: string,
  draft: { actualCost: number; actualRevenue: number; piecesBuilt: number; notes: string }
): Promise<ProjectOutcome> {
  const { outcome } = await api<{ outcome: ProjectOutcome }>(`/api/projects/${projectId}/outcome`, {
    method: "PUT",
    body: JSON.stringify(draft),
  });
  return outcome;
}

export async function clearProjectOutcomeApi(projectId: string): Promise<void> {
  await api(`/api/projects/${projectId}/outcome`, { method: "DELETE" });
}
