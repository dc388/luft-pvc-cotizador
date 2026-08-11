import type { ComponentRecord, ComponentSummary } from "@/types/project";
import type {
  AgentChange,
  AgentFinding,
  Confidence,
  JsonValue,
  LuftAgentId,
  LuftPermission,
  LuftRole,
  SourceEvidence,
} from "@/types/luft-ai";

export type LuftActor = { id: string; role: LuftRole; displayName?: string };

export type AgentContext = {
  actor: LuftActor;
  projectId: string;
  projectName: string;
  component: ComponentRecord;
  componentSummaries: ComponentSummary[];
  now: string;
};

export type RequestedChange = { path: string; value: JsonValue };

export type AgentTask = {
  id: string;
  intent: "review" | "propose-change";
  prompt: string;
  requestedChange?: RequestedChange;
};

export type AgentPayload = {
  summary: string;
  findings: AgentFinding[];
  changes: AgentChange[];
  dirtyPaths: string[];
};

// Common result contract: agents never throw domain validation at the UI and never return
// an unlabelled value. Every claim carries evidence and an explicit confidence level.
export type AgentResult<T = AgentPayload> = {
  agentId: LuftAgentId;
  taskId: string;
  ok: boolean;
  payload: T | null;
  validationErrors: AgentFinding[];
  warnings: AgentFinding[];
  source: SourceEvidence[];
  confidence: Confidence;
};

export interface LuftAgent {
  id: LuftAgentId;
  name: string;
  role: "orchestrator" | "specialist";
  permissions: LuftPermission[];
  run(context: AgentContext, task: AgentTask): AgentResult;
}

export const HIGH_CONFIDENCE: Confidence = { level: "high", score: 0.95, reasons: ["Regla determinista con entrada confirmada."] };
export const MEDIUM_CONFIDENCE: Confidence = { level: "medium", score: 0.7, reasons: ["Dato disponible, pendiente de ficha técnica completa."] };
export const LOW_CONFIDENCE: Confidence = { level: "low", score: 0.35, reasons: ["Fuente parcial o no verificada."] };
export const BLOCKED_CONFIDENCE: Confidence = { level: "blocked", score: 0, reasons: ["Falta una fuente técnica verificable."] };

export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

const CONFIDENCE_RANK: Record<Confidence["level"], number> = { high: 3, medium: 2, low: 1, blocked: 0 };

export function lowestConfidence(values: Confidence[]): Confidence {
  if (values.length === 0) return MEDIUM_CONFIDENCE;
  return values.reduce((lowest, current) =>
    CONFIDENCE_RANK[current.level] < CONFIDENCE_RANK[lowest.level] ? current : lowest
  );
}

export function finding(args: Omit<AgentFinding, "id">): AgentFinding {
  return { ...args, id: makeId("finding") };
}

export function proposedChange(
  context: AgentContext,
  agentId: LuftAgentId,
  path: string,
  previousValue: JsonValue,
  nextValue: JsonValue,
  reason: string,
  confidence: Confidence,
  sources: SourceEvidence[],
  affects: string[]
): AgentChange {
  return {
    id: makeId("change"),
    agentId,
    componentId: context.component.id,
    path,
    previousValue,
    nextValue,
    reason,
    affects,
    approval: "pending",
    confidence,
    sources,
    createdAt: context.now,
  };
}

export function result(
  agentId: LuftAgentId,
  task: AgentTask,
  summary: string,
  findings: AgentFinding[],
  changes: AgentChange[] = [],
  dirtyPaths: string[] = []
): AgentResult {
  const validationErrors = findings.filter((item) => item.severity === "error");
  const warnings = findings.filter((item) => item.severity === "warning");
  const confidences = [...findings.map((item) => item.confidence), ...changes.map((item) => item.confidence)];
  const sources = dedupeSources([
    ...findings.flatMap((item) => item.sources),
    ...changes.flatMap((item) => item.sources),
  ]);
  return {
    agentId,
    taskId: task.id,
    ok: !findings.some((item) => item.blocking),
    payload: { summary, findings, changes, dirtyPaths },
    validationErrors,
    warnings,
    source: sources,
    confidence: lowestConfidence(confidences),
  };
}

export function dedupeSources(sources: SourceEvidence[]): SourceEvidence[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.kind}:${source.reference}:${source.note ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
