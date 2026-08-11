import { catalog } from "@/data/catalog";
import { glassCatalog } from "@/data/glass";
import { allowedWingsFor, findNode, remapTreeToSystem, setWing, updateMarco, updateSpec } from "@/lib/tree";
import type { ComponentRecord } from "@/types/project";
import type { AgentChange, JsonValue } from "@/types/luft-ai";

export type ApplyChangesResult = {
  component: ComponentRecord;
  applied: AgentChange[];
  rejected: { change: AgentChange; reason: string }[];
};

function sameValue(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function currentValue(component: ComponentRecord, path: string): JsonValue | undefined {
  if (path === "component.widthMm") return component.widthMm;
  if (path === "component.heightMm") return component.heightMm;
  if (path === "component.qty") return component.qty;
  if (path === "component.systemIndex") return component.systemIndex;
  if (path === "component.data.glassIndex") return component.data.glassIndex;
  if (path === "component.data.marco.profileCode") return component.data.marco.profileCode;
  const leaf = path.match(/^component\.data\.tree\.leaf\.([^.]+)\.(wing|spec\.(profileCode|hardware))$/);
  const node = leaf ? findNode(component.data.tree, leaf[1]) : null;
  if (node?.kind !== "leaf" || !leaf) return undefined;
  if (leaf[2] === "wing") return node.wing;
  return leaf[3] === "profileCode" ? node.spec.profileCode : node.spec.hardware;
}

function applyOne(component: ComponentRecord, change: AgentChange): ComponentRecord | null {
  if (change.path === "component.widthMm" && typeof change.nextValue === "number") return { ...component, widthMm: change.nextValue };
  if (change.path === "component.heightMm" && typeof change.nextValue === "number") return { ...component, heightMm: change.nextValue };
  if (change.path === "component.qty" && typeof change.nextValue === "number") return { ...component, qty: change.nextValue };
  if (change.path === "component.data.glassIndex" && typeof change.nextValue === "number" && glassCatalog[change.nextValue]) {
    return { ...component, data: { ...component.data, glassIndex: change.nextValue } };
  }
  if (change.path === "component.systemIndex" && typeof change.nextValue === "number") {
    const system = catalog[component.brand][change.nextValue];
    if (!system) return null;
    return {
      ...component,
      systemIndex: change.nextValue,
      data: {
        ...component.data,
        rail: system.rails[0],
        tree: remapTreeToSystem(component.data.tree, allowedWingsFor(system)),
      },
    };
  }
  if (change.path === "component.data.marco.profileCode" && typeof change.nextValue === "string") {
    return { ...component, data: { ...component.data, marco: updateMarco(component.data.marco, { profileCode: change.nextValue }) } };
  }
  const leaf = change.path.match(/^component\.data\.tree\.leaf\.([^.]+)\.(wing|spec\.(profileCode|hardware))$/);
  if (!leaf || typeof change.nextValue !== "string") return null;
  const node = findNode(component.data.tree, leaf[1]);
  if (node?.kind !== "leaf") return null;
  const tree = leaf[2] === "wing"
    ? setWing(component.data.tree, leaf[1], change.nextValue as typeof node.wing)
    : updateSpec(component.data.tree, leaf[1], { [leaf[3]]: change.nextValue });
  return { ...component, data: { ...component.data, tree } };
}

// Applies only explicit, approved changes and refuses stale proposals. The previous value check
// prevents an old agent result from overwriting a newer human edit.
export function applyApprovedChanges(component: ComponentRecord, changes: AgentChange[], now = new Date().toISOString()): ApplyChangesResult {
  let next = component;
  const applied: AgentChange[] = [];
  const rejected: { change: AgentChange; reason: string }[] = [];
  for (const change of changes) {
    if (change.componentId !== component.id || change.approval !== "approved") {
      rejected.push({ change, reason: "La propuesta no está aprobada o pertenece a otro componente." });
      continue;
    }
    const current = currentValue(next, change.path);
    if (current === undefined || !sameValue(current, change.previousValue)) {
      rejected.push({ change, reason: "El valor cambió después de generar la propuesta; se requiere una nueva revisión." });
      continue;
    }
    const candidate = applyOne(next, change);
    if (!candidate) {
      rejected.push({ change, reason: "La ruta o el valor no son aplicables por el motor determinista." });
      continue;
    }
    next = { ...candidate, updatedAt: now };
    applied.push({ ...change, approval: "applied" });
  }
  return { component: next, applied, rejected };
}
