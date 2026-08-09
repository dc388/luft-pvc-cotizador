import type { ComponentData, ComponentPatch, ComponentRecord, ProjectRecord } from "@/types/project";
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

export type BootstrapResult = { project: ProjectRecord | null; component: ComponentRecord; mode: "db" | "offline" };

// Runs once on mount: loads the most recently touched project + its active component from
// the DB, creating a brand-new project if none exists yet, or transparently falls back to
// the last offline-saved component if the DB isn't reachable in this environment.
export async function bootstrap(): Promise<BootstrapResult> {
  try {
    let { project } = await api<{ project: ProjectRecord | null }>("/api/projects");
    if (!project) {
      ({ project } = await api<{ project: ProjectRecord }>("/api/projects", { method: "POST", body: JSON.stringify({}) }));
    }
    const activeId = project.activeComponentId ?? project.components[0]?.id;
    if (!activeId) throw new Error("El proyecto no tiene ningún componente.");
    const { component } = await api<{ component: ComponentRecord }>(`/api/projects/${project.id}/components/${activeId}`);
    return { project, component, mode: "db" };
  } catch {
    const offline = readOffline();
    const component = offline
      ? offlineToComponentRecord(offline)
      : { id: "offline", projectId: "offline", position: 0, code: "001", designation: "V01", location: "", qty: 1, widthMm: 4000, heightMm: 2200, brand: "Aluplast" as const, systemIndex: 0, colorIndex: 1, data: defaultComponentData(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return { project: null, component, mode: "offline" };
  }
}

export async function saveComponent(
  projectId: string,
  componentId: string,
  patch: ComponentPatch
): Promise<{ savedAt: string | null; mode: "db" | "offline" }> {
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
    return { savedAt: merged.savedAt, mode: "offline" };
  }
  try {
    const { component } = await api<{ component: ComponentRecord }>(`/api/projects/${projectId}/components/${componentId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { savedAt: component.updatedAt, mode: "db" };
  } catch {
    return { savedAt: null, mode: "db" };
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
