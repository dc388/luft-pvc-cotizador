export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type LuftAgentId =
  | "luft-director"
  | "design-engineer"
  | "profile-engineer"
  | "glass-engineer"
  | "hardware-engineer";

export type LuftRole = "owner" | "technical" | "sales" | "production" | "viewer";
export type LuftPermission = "project:read" | "component:review" | "component:propose" | "component:approve";
export type ConfidenceLevel = "high" | "medium" | "low" | "blocked";
export type FindingSeverity = "info" | "warning" | "error";
export type DirtyStatus = "clean" | "dirty" | "blocked";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "applied";

export type Confidence = {
  level: ConfidenceLevel;
  score: number;
  reasons: string[];
};

export type SourceEvidence = {
  kind: "deterministic-engine" | "verified-catalog" | "project-data" | "field-measurement" | "estimate" | "missing";
  reference: string;
  note?: string;
};

export type AgentFinding = {
  id: string;
  agentId: LuftAgentId;
  code: string;
  severity: FindingSeverity;
  title: string;
  message: string;
  path?: string;
  blocking: boolean;
  confidence: Confidence;
  sources: SourceEvidence[];
};

export type AgentChange = {
  id: string;
  agentId: LuftAgentId;
  componentId: string;
  path: string;
  previousValue: JsonValue;
  nextValue: JsonValue;
  reason: string;
  affects: string[];
  approval: ApprovalStatus;
  confidence: Confidence;
  sources: SourceEvidence[];
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
};

export type AgentFieldState = {
  path: string;
  status: DirtyStatus;
  causedBy: string[];
  lastAgentId: LuftAgentId;
  confidence: Confidence;
  sources: SourceEvidence[];
  updatedAt: string;
};

export type AgentAuditEntry = {
  id: string;
  actorId: string;
  actorRole: LuftRole;
  agentId: LuftAgentId;
  action: "reviewed" | "proposed" | "approved" | "rejected" | "applied";
  componentId: string;
  changeIds: string[];
  message: string;
  createdAt: string;
};

export type AgentRunSummary = {
  id: string;
  agentId: LuftAgentId;
  intent: "review" | "propose-change";
  status: "completed" | "needs-review" | "blocked" | "forbidden";
  summary: string;
  findings: AgentFinding[];
  changes: AgentChange[];
  dirtyPaths: string[];
  confidence: Confidence;
  sources: SourceEvidence[];
  createdAt: string;
};

export type LuftAgentState = {
  version: 1;
  revision: number;
  fieldStates: Record<string, AgentFieldState>;
  pendingChanges: AgentChange[];
  lastRun: AgentRunSummary | null;
  audit: AgentAuditEntry[];
};

export function emptyLuftAgentState(): LuftAgentState {
  return { version: 1, revision: 0, fieldStates: {}, pendingChanges: [], lastRun: null, audit: [] };
}
