import type { AgentFieldState, Confidence, LuftAgentId, SourceEvidence } from "@/types/luft-ai";

const DEPENDENCIES: Record<string, string[]> = {
  "component.widthMm": ["design.geometry", "profile.cuts", "glass.dimensions", "hardware.loads", "quote", "production"],
  "component.heightMm": ["design.geometry", "profile.cuts", "glass.dimensions", "hardware.loads", "quote", "production"],
  "component.qty": ["quote", "profile.consumption", "glass.order", "hardware.order", "production"],
  "component.systemIndex": ["design.compatibility", "profile.selection", "glass.compatibility", "hardware.compatibility", "quote", "production"],
  "component.data.glassIndex": ["glass.compatibility", "glass.order", "hardware.loads", "quote", "production"],
  "component.data.tree": ["design.geometry", "profile.cuts", "glass.dimensions", "hardware.configuration", "quote", "production"],
  "component.data.marco": ["profile.cuts", "hardware.configuration", "quote", "production"],
};

function dependencyKey(path: string): string {
  if (path.startsWith("component.data.tree.leaf.")) return "component.data.tree";
  if (path.startsWith("component.data.marco.")) return "component.data.marco";
  return path;
}

export function propagateDirtyPaths(changedPaths: string[]): string[] {
  const dirty = new Set<string>();
  for (const path of changedPaths) {
    dirty.add(path);
    for (const dependent of DEPENDENCIES[dependencyKey(path)] ?? []) dirty.add(dependent);
  }
  return [...dirty];
}

export function buildDirtyFieldStates(
  paths: string[],
  agentId: LuftAgentId,
  confidence: Confidence,
  sources: SourceEvidence[],
  now: string
): Record<string, AgentFieldState> {
  return Object.fromEntries(paths.map((path) => [path, {
    path,
    status: confidence.level === "blocked" ? "blocked" : "dirty",
    causedBy: paths.filter((candidate) => candidate.startsWith("component.")),
    lastAgentId: agentId,
    confidence,
    sources,
    updatedAt: now,
  }]));
}
