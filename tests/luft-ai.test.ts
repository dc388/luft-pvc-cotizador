import test from "node:test";
import assert from "node:assert/strict";
import { defaultComponentData } from "@/lib/componentDefaults";
import { findNode, firstLeafId, splitLeaf, walkLeaves } from "@/lib/tree";
import type { ComponentRecord } from "@/types/project";
import type { AgentContext, LuftActor } from "@/lib/luft-ai";
import {
  applyApprovedChanges,
  decidePendingChanges,
  interpretPrompt,
  luftDirector,
  recordAgentResult,
} from "@/lib/luft-ai";
import { emptyLuftAgentState } from "@/types/luft-ai";

const technical: LuftActor = { id: "test@luft.local", role: "technical" };

function component(): ComponentRecord {
  const data = defaultComponentData();
  return {
    id: "component-1",
    projectId: "project-1",
    position: 0,
    code: "001",
    designation: "V01",
    location: "Sala",
    qty: 1,
    widthMm: 3000,
    heightMm: 2200,
    brand: "Aluplast",
    systemIndex: 0,
    colorIndex: 1,
    glassIndex: data.glassIndex,
    typology: "Corrediza",
    configState: "ok",
    unitPrice: 0,
    total: 0,
    data,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
  };
}

function context(record = component(), actor = technical): AgentContext {
  return {
    actor,
    projectId: record.projectId,
    projectName: "Proyecto de prueba",
    component: record,
    componentSummaries: [],
    now: "2026-08-10T01:00:00.000Z",
  };
}

test("LUFT Director revisa con evidencia y no inventa herrajes", () => {
  const task = { id: "review-1", intent: "review" as const, prompt: "Revisa el componente" };
  const result = luftDirector.run(context(), task);
  assert.equal(result.agentId, "luft-director");
  assert.ok(result.source.length > 0);
  assert.ok(result.payload?.findings.some((item) => item.agentId === "hardware-engineer"));
  assert.ok(result.payload?.findings.some((item) => item.sources.some((source) => source.kind === "missing")));
});

test("un ancho se propone, aprueba y aplica sin alterar los demás campos", () => {
  const record = component();
  const interpreted = interpretPrompt("Cambia el ancho a 3200", context(record));
  assert.equal(interpreted.ok, true);
  if (!interpreted.ok) return;
  const result = luftDirector.run(context(record), interpreted.task);
  assert.equal(result.payload?.changes.length, 1);
  assert.ok(result.payload?.dirtyPaths.includes("quote"));

  let state = recordAgentResult(emptyLuftAgentState(), result, technical, record.id, "propose-change");
  const changeId = state.pendingChanges[0].id;
  state = decidePendingChanges(state, [changeId], "approved", technical);
  const approved = state.pendingChanges.filter((change) => change.approval === "approved");
  const applied = applyApprovedChanges(record, approved, "2026-08-10T02:00:00.000Z");

  assert.equal(applied.component.widthMm, 3200);
  assert.equal(applied.component.heightMm, record.heightMm);
  assert.equal(applied.component.designation, record.designation);
  assert.deepEqual(applied.component.data.tree, record.data.tree);
  assert.equal(applied.applied.length, 1);
});

test("una propuesta obsoleta no sobreescribe una edición humana posterior", () => {
  const record = component();
  const interpreted = interpretPrompt("Cambia el ancho a 3200", context(record));
  assert.ok(interpreted.ok);
  if (!interpreted.ok) return;
  const result = luftDirector.run(context(record), interpreted.task);
  const proposal = { ...result.payload!.changes[0], approval: "approved" as const };
  const manuallyEdited = { ...record, widthMm: 3100 };
  const applied = applyApprovedChanges(manuallyEdited, [proposal]);
  assert.equal(applied.component.widthMm, 3100);
  assert.equal(applied.applied.length, 0);
  assert.match(applied.rejected[0].reason, /cambió/);
});

test("cambiar una sola hoja conserva intacta su hoja hermana", () => {
  const record = component();
  const originalLeafId = firstLeafId(record.data.tree);
  const tree = splitLeaf(record.data.tree, originalLeafId, "col", 0.5);
  const leaves = walkLeaves(tree);
  assert.ok(leaves.length >= 2);
  const prepared = { ...record, data: { ...record.data, tree, selectedId: leaves[0].id } };
  const task = {
    id: "leaf-change",
    intent: "propose-change" as const,
    prompt: "Convierte la hoja seleccionada en fija",
    requestedChange: { path: `component.data.tree.leaf.${leaves[0].id}.wing`, value: "fixed" },
  };
  const result = luftDirector.run(context(prepared), task);
  const proposal = { ...result.payload!.changes[0], approval: "approved" as const };
  const siblingBefore = findNode(tree, leaves[1].id);
  const applied = applyApprovedChanges(prepared, [proposal]);
  const changedAfter = findNode(applied.component.data.tree, leaves[0].id);
  const siblingAfter = findNode(applied.component.data.tree, leaves[1].id);
  assert.equal(changedAfter?.kind === "leaf" ? changedAfter.wing : null, "fixed");
  assert.deepEqual(siblingAfter, siblingBefore);
});

test("un viewer no puede ejecutar revisión técnica", () => {
  const task = { id: "viewer-review", intent: "review" as const, prompt: "Revisa" };
  const result = luftDirector.run(context(component(), { id: "viewer", role: "viewer" }), task);
  assert.equal(result.ok, false);
  assert.equal(result.validationErrors[0].code, "DIRECTOR_FORBIDDEN");
});
