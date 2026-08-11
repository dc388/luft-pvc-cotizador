import type { AgentResult } from "./contracts";
import { buildDirtyFieldStates } from "./dependencies";
import { hasPermission } from "./permissions";
import { makeId } from "./contracts";
import type { AgentAuditEntry, AgentChange, LuftAgentState } from "@/types/luft-ai";
import { emptyLuftAgentState } from "@/types/luft-ai";
import type { LuftActor } from "./contracts";

const MAX_AUDIT_ENTRIES = 100;

function appendAudit(state: LuftAgentState, entry: AgentAuditEntry): AgentAuditEntry[] {
  return [...state.audit, entry].slice(-MAX_AUDIT_ENTRIES);
}

export function normalizeAgentState(value: LuftAgentState | undefined): LuftAgentState {
  if (!value || value.version !== 1) return emptyLuftAgentState();
  return {
    ...emptyLuftAgentState(),
    ...value,
    fieldStates: value.fieldStates ?? {},
    pendingChanges: value.pendingChanges ?? [],
    audit: (value.audit ?? []).slice(-MAX_AUDIT_ENTRIES),
  };
}

export function recordAgentResult(
  previous: LuftAgentState | undefined,
  result: AgentResult,
  actor: LuftActor,
  componentId: string,
  intent: "review" | "propose-change",
  now = new Date().toISOString()
): LuftAgentState {
  const state = normalizeAgentState(previous);
  const payload = result.payload;
  const findings = payload?.findings ?? result.validationErrors;
  const changes = payload?.changes ?? [];
  const dirtyPaths = payload?.dirtyPaths ?? [];
  const status = !result.ok ? "blocked" : changes.length ? "needs-review" : "completed";
  const fieldStates = {
    ...state.fieldStates,
    ...buildDirtyFieldStates(dirtyPaths, result.agentId, result.confidence, result.source, now),
  };
  for (const issue of findings) {
    if (!issue.path) continue;
    fieldStates[issue.path] = {
      path: issue.path,
      status: issue.blocking ? "blocked" : "dirty",
      causedBy: [issue.code],
      lastAgentId: issue.agentId,
      confidence: issue.confidence,
      sources: issue.sources,
      updatedAt: now,
    };
  }
  const run = {
    id: makeId("run"),
    agentId: result.agentId,
    intent,
    status,
    summary: payload?.summary ?? "Ejecución sin resumen.",
    findings,
    changes,
    dirtyPaths,
    confidence: result.confidence,
    sources: result.source,
    createdAt: now,
  } as const;
  const action = changes.length ? "proposed" : "reviewed";
  const audit: AgentAuditEntry = {
    id: makeId("audit"),
    actorId: actor.id,
    actorRole: actor.role,
    agentId: result.agentId,
    action,
    componentId,
    changeIds: changes.map((change) => change.id),
    message: run.summary,
    createdAt: now,
  };
  return {
    version: 1,
    revision: state.revision + 1,
    fieldStates,
    pendingChanges: [...state.pendingChanges, ...changes].slice(-20),
    lastRun: run,
    audit: appendAudit(state, audit),
  };
}

export function decidePendingChanges(
  previous: LuftAgentState,
  changeIds: string[],
  decision: "approved" | "rejected",
  actor: LuftActor,
  now = new Date().toISOString()
): LuftAgentState {
  const state = normalizeAgentState(previous);
  if (!hasPermission(actor.role, "component:approve")) return state;
  const selected = new Set(changeIds);
  const pendingChanges = state.pendingChanges.map((change): AgentChange => {
    if (!selected.has(change.id) || change.approval !== "pending" || change.confidence.level === "blocked") return change;
    return { ...change, approval: decision, approvedBy: actor.id, approvedAt: now };
  });
  const affected = pendingChanges.filter((change) => selected.has(change.id) && change.approval === decision);
  if (affected.length === 0) return state;
  const componentId = affected[0].componentId;
  const audit: AgentAuditEntry = {
    id: makeId("audit"), actorId: actor.id, actorRole: actor.role, agentId: "luft-director",
    action: decision, componentId, changeIds: affected.map((change) => change.id),
    message: decision === "approved" ? "El usuario aprobó la propuesta técnica." : "El usuario rechazó la propuesta técnica.",
    createdAt: now,
  };
  return { ...state, revision: state.revision + 1, pendingChanges, audit: appendAudit(state, audit) };
}

export function recordAppliedChanges(
  previous: LuftAgentState,
  applied: AgentChange[],
  actor: LuftActor,
  now = new Date().toISOString()
): LuftAgentState {
  if (applied.length === 0) return previous;
  const appliedIds = new Set(applied.map((change) => change.id));
  const state = normalizeAgentState(previous);
  const pendingChanges = state.pendingChanges.map((change): AgentChange =>
    appliedIds.has(change.id) ? { ...change, approval: "applied" } : change
  );
  const audit: AgentAuditEntry = {
    id: makeId("audit"), actorId: actor.id, actorRole: actor.role, agentId: "luft-director",
    action: "applied", componentId: applied[0].componentId, changeIds: [...appliedIds],
    message: "El motor determinista aplicó los cambios aprobados; sus dependencias permanecen DIRTY hasta una nueva revisión.",
    createdAt: now,
  };
  return { ...state, revision: state.revision + 1, pendingChanges, audit: appendAudit(state, audit) };
}
