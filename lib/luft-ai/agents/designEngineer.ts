import { MIN_OPENING_MM } from "@/lib/calc";
import { allowedWingsFor, findNode, walkLeaves } from "@/lib/tree";
import { catalog } from "@/data/catalog";
import { wingDefs } from "@/data/wings";
import type { FrameNode, WingType } from "@/types/domain";
import type { JsonValue } from "@/types/luft-ai";
import type { AgentContext, AgentTask, LuftAgent } from "../contracts";
import { BLOCKED_CONFIDENCE, HIGH_CONFIDENCE, MEDIUM_CONFIDENCE, finding, proposedChange, result } from "../contracts";
import { propagateDirtyPaths } from "../dependencies";
import { PROJECT_SOURCE, SYSTEM_CATALOG_SOURCE, TREE_ENGINE_SOURCE, WING_CATALOG_SOURCE } from "../sources";

function ratiosAreValid(node: FrameNode): boolean {
  if (node.kind === "leaf") return true;
  const sum = node.ratios.reduce((total, ratio) => total + ratio, 0);
  return node.children.length === node.ratios.length && Math.abs(sum - 1) < 0.01 && node.children.every(ratiosAreValid);
}

function previousForPath(context: AgentContext, path: string): JsonValue | undefined {
  if (path === "component.widthMm") return context.component.widthMm;
  if (path === "component.heightMm") return context.component.heightMm;
  if (path === "component.qty") return context.component.qty;
  const leafWing = path.match(/^component\.data\.tree\.leaf\.([^.]+)\.wing$/);
  if (leafWing) {
    const node = findNode(context.component.data.tree, leafWing[1]);
    return node?.kind === "leaf" ? node.wing : undefined;
  }
  return undefined;
}

export const designEngineer: LuftAgent = {
  id: "design-engineer",
  name: "Design Engineer",
  role: "specialist",
  permissions: ["project:read", "component:review", "component:propose"],
  run(context: AgentContext, task: AgentTask) {
    const { component } = context;
    const system = catalog[component.brand][component.systemIndex];
    const findings = [];

    if (!system) {
      findings.push(finding({
        agentId: this.id, code: "DESIGN_SYSTEM_UNKNOWN", severity: "error", title: "Sistema inexistente",
        message: "El índice de sistema no existe en el catálogo de la marca seleccionada.", path: "component.systemIndex",
        blocking: true, confidence: BLOCKED_CONFIDENCE, sources: [PROJECT_SOURCE, SYSTEM_CATALOG_SOURCE],
      }));
      return result(this.id, task, "La revisión de diseño quedó bloqueada por un sistema inexistente.", findings);
    }

    const leaves = walkLeaves(component.data.tree);
    if (leaves.length === 0 || new Set(leaves.map((leaf) => leaf.id)).size !== leaves.length) {
      findings.push(finding({
        agentId: this.id, code: "DESIGN_TREE_IDS", severity: "error", title: "Árbol de diseño inválido",
        message: "El componente debe contener al menos una hoja y todos sus identificadores deben ser únicos.", path: "component.data.tree",
        blocking: true, confidence: HIGH_CONFIDENCE, sources: [TREE_ENGINE_SOURCE],
      }));
    }
    if (!ratiosAreValid(component.data.tree)) {
      findings.push(finding({
        agentId: this.id, code: "DESIGN_RATIOS", severity: "error", title: "Divisiones inconsistentes",
        message: "Las proporciones del árbol no suman 1 o no corresponden a sus hijos.", path: "component.data.tree",
        blocking: true, confidence: HIGH_CONFIDENCE, sources: [TREE_ENGINE_SOURCE],
      }));
    }
    if (component.widthMm < MIN_OPENING_MM || component.heightMm < MIN_OPENING_MM) {
      findings.push(finding({
        agentId: this.id, code: "DESIGN_MIN_SIZE", severity: "error", title: "Medida no fabricable",
        message: `Ancho y alto deben ser al menos ${MIN_OPENING_MM} mm.`, path: "component.widthMm",
        blocking: true, confidence: HIGH_CONFIDENCE, sources: [TREE_ENGINE_SOURCE],
      }));
    }
    if (component.widthMm > system.maxW || component.heightMm > system.maxH) {
      findings.push(finding({
        agentId: this.id, code: "DESIGN_MAX_SIZE", severity: "error", title: "Límite de sistema excedido",
        message: `La medida ${component.widthMm} × ${component.heightMm} mm supera la referencia ${system.maxW} × ${system.maxH} mm.`,
        path: "component.widthMm", blocking: true, confidence: MEDIUM_CONFIDENCE, sources: [SYSTEM_CATALOG_SOURCE],
      }));
    }

    if (task.intent === "propose-change") {
      const request = task.requestedChange;
      if (!request) {
        findings.push(finding({
          agentId: this.id, code: "DESIGN_CHANGE_MISSING", severity: "error", title: "Cambio incompleto",
          message: "La solicitud no contiene una ruta y un valor verificables.", blocking: true,
          confidence: BLOCKED_CONFIDENCE, sources: [PROJECT_SOURCE],
        }));
      } else {
        const previous = previousForPath(context, request.path);
        let allowed = previous !== undefined;
        if (["component.widthMm", "component.heightMm", "component.qty"].includes(request.path)) {
          allowed = typeof request.value === "number" && Number.isFinite(request.value) && Number.isInteger(request.value) && request.value > 0;
        }
        const leafMatch = request.path.match(/^component\.data\.tree\.leaf\.([^.]+)\.wing$/);
        if (leafMatch) {
          const wing = request.value as WingType;
          allowed = !!wingDefs.find((definition) => definition.id === wing) && allowedWingsFor(system).includes(wing);
        }
        if (!allowed || previous === undefined) {
          findings.push(finding({
            agentId: this.id, code: "DESIGN_CHANGE_REJECTED", severity: "error", title: "Cambio de diseño no válido",
            message: "La ruta, el valor o la tipología solicitada no son compatibles con este componente.", path: request.path,
            blocking: true, confidence: HIGH_CONFIDENCE, sources: [TREE_ENGINE_SOURCE, WING_CATALOG_SOURCE],
          }));
        } else {
          const dirtyPaths = propagateDirtyPaths([request.path]);
          const change = proposedChange(context, this.id, request.path, previous, request.value,
            "Cambio de diseño solicitado por el usuario; requiere aprobación antes de aplicarse.",
            HIGH_CONFIDENCE, [PROJECT_SOURCE, TREE_ENGINE_SOURCE], dirtyPaths);
          return result(this.id, task, `Design Engineer preparó un cambio en ${request.path}.`, findings, [change], dirtyPaths);
        }
      }
    }

    return result(this.id, task, findings.length ? "Design Engineer encontró observaciones que requieren revisión." : "Geometría y árbol de diseño consistentes.", findings);
  },
};
