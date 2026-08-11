import { findNode, walkLeaves } from "@/lib/tree";
import { SLIDING_WINGS } from "@/lib/tree";
import type { WingType } from "@/types/domain";
import type { AgentContext, AgentTask, LuftAgent } from "../contracts";
import { BLOCKED_CONFIDENCE, LOW_CONFIDENCE, finding, result } from "../contracts";
import { MISSING_HARDWARE_SOURCE, PROJECT_SOURCE, WING_CATALOG_SOURCE } from "../sources";

const NO_HARDWARE_WINGS: WingType[] = ["fixed", "inactive", "sliding-fixed"];

export const hardwareEngineer: LuftAgent = {
  id: "hardware-engineer",
  name: "Hardware Engineer",
  role: "specialist",
  permissions: ["project:read", "component:review", "component:propose"],
  run(context: AgentContext, task: AgentTask) {
    const findings = [];
    for (const leaf of walkLeaves(context.component.data.tree)) {
      const path = `component.data.tree.leaf.${leaf.id}.spec.hardware`;
      if (!NO_HARDWARE_WINGS.includes(leaf.wing) && !leaf.spec.hardware.trim()) {
        findings.push(finding({
          agentId: this.id, code: "HARDWARE_UNASSIGNED", severity: "error", title: "Herraje sin definir",
          message: `La hoja ${leaf.id} (${leaf.wing}) necesita una selección de herraje confirmada por un técnico.`,
          path, blocking: true, confidence: BLOCKED_CONFIDENCE, sources: [PROJECT_SOURCE, MISSING_HARDWARE_SOURCE],
        }));
      } else if (leaf.spec.hardware.trim()) {
        findings.push(finding({
          agentId: this.id, code: "HARDWARE_UNVERIFIED", severity: "warning", title: "Herraje sin catálogo verificable",
          message: `“${leaf.spec.hardware}” está guardado en el proyecto, pero no puede validarse contra SKU, capacidad o proveedor.`,
          path, blocking: false, confidence: LOW_CONFIDENCE, sources: [PROJECT_SOURCE, MISSING_HARDWARE_SOURCE],
        }));
      }
      if (SLIDING_WINGS.includes(leaf.wing) && leaf.spec.railIndex <= 0) {
        findings.push(finding({
          agentId: this.id, code: "HARDWARE_RAIL_MISSING", severity: "error", title: "Riel sin asignar",
          message: `La hoja corrediza ${leaf.id} no tiene un riel físico asignado.`,
          path: `component.data.tree.leaf.${leaf.id}.spec.railIndex`, blocking: true,
          confidence: LOW_CONFIDENCE, sources: [PROJECT_SOURCE, WING_CATALOG_SOURCE],
        }));
      }
    }

    if (task.intent === "propose-change") {
      const request = task.requestedChange;
      const match = request?.path.match(/^component\.data\.tree\.leaf\.([^.]+)\.spec\.hardware$/);
      const node = match ? findNode(context.component.data.tree, match[1]) : null;
      findings.push(finding({
        agentId: this.id, code: "HARDWARE_CHANGE_BLOCKED", severity: "error", title: "Selección de herraje bloqueada",
        message: node?.kind === "leaf"
          ? "El valor solicitado no puede confirmarse porque LUFT PVC aún no tiene catálogo técnico de herrajes."
          : "La hoja indicada no existe en el componente.",
        path: request?.path, blocking: true, confidence: BLOCKED_CONFIDENCE,
        sources: [MISSING_HARDWARE_SOURCE],
      }));
    }

    return result(this.id, task,
      findings.length ? "Hardware Engineer requiere catálogo técnico o confirmación humana." : "Las hojas fijas no requieren selección de herraje.",
      findings);
  },
};
