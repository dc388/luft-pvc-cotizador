import { catalog } from "@/data/catalog";
import { familiesForSystem } from "@/lib/profileMatch";
import { findNode, walkLeaves } from "@/lib/tree";
import type { AgentContext, AgentTask, LuftAgent } from "../contracts";
import { BLOCKED_CONFIDENCE, HIGH_CONFIDENCE, LOW_CONFIDENCE, MEDIUM_CONFIDENCE, finding, proposedChange, result } from "../contracts";
import { propagateDirtyPaths } from "../dependencies";
import { PROFILE_CATALOG_SOURCE, PROJECT_SOURCE, SYSTEM_CATALOG_SOURCE } from "../sources";

export const profileEngineer: LuftAgent = {
  id: "profile-engineer",
  name: "Profile Engineer",
  role: "specialist",
  permissions: ["project:read", "component:review", "component:propose"],
  run(context: AgentContext, task: AgentTask) {
    const { component } = context;
    const system = catalog[component.brand][component.systemIndex];
    const findings = [];
    if (!system) {
      findings.push(finding({
        agentId: this.id, code: "PROFILE_SYSTEM_UNKNOWN", severity: "error", title: "Sistema inexistente",
        message: "No se puede buscar una familia de perfiles para un sistema fuera del catálogo.", path: "component.systemIndex",
        blocking: true, confidence: BLOCKED_CONFIDENCE, sources: [SYSTEM_CATALOG_SOURCE],
      }));
      return result(this.id, task, "Profile Engineer quedó bloqueado.", findings);
    }

    const families = familiesForSystem(component.brand, system.name);
    if (!system.sourced) {
      findings.push(finding({
        agentId: this.id, code: "PROFILE_ESTIMATED_SYSTEM", severity: "warning", title: "Sistema sin precio de origen",
        message: "Marco, hoja y herraje de este sistema usan valores estimados; no deben liberarse como costo confirmado.",
        path: "component.systemIndex", blocking: false, confidence: LOW_CONFIDENCE,
        sources: [{ ...SYSTEM_CATALOG_SOURCE, kind: "estimate" }],
      }));
    }
    if (families.length === 0) {
      findings.push(finding({
        agentId: this.id, code: "PROFILE_CATALOG_MISSING", severity: "error", title: "Catálogo de perfiles pendiente",
        message: `No existe una familia de perfiles verificada para ${component.brand} · ${system.name}.`,
        path: "component.data.marco.profileCode", blocking: true, confidence: BLOCKED_CONFIDENCE,
        sources: [{ kind: "missing", reference: `Familias para ${component.brand} · ${system.name}` }],
      }));
    } else {
      const validCodes = new Set(families.map((family) => family.code));
      const selectedCodes = [component.data.marco.profileCode, ...walkLeaves(component.data.tree).map((leaf) => leaf.spec.profileCode)].filter(Boolean);
      for (const code of selectedCodes) {
        if (!validCodes.has(code)) findings.push(finding({
          agentId: this.id, code: "PROFILE_CODE_INCOMPATIBLE", severity: "error", title: "Perfil incompatible",
          message: `El código ${code} no pertenece a las familias verificadas de ${system.name}.`,
          path: "component.data.tree", blocking: true, confidence: HIGH_CONFIDENCE, sources: [PROFILE_CATALOG_SOURCE],
        }));
      }
      if (!component.data.marco.profileCode) findings.push(finding({
        agentId: this.id, code: "PROFILE_FRAME_UNASSIGNED", severity: "warning", title: "Perfil de marco sin asignar",
        message: "Hay familias compatibles, pero el marco del conjunto aún no tiene un código seleccionado.",
        path: "component.data.marco.profileCode", blocking: false, confidence: MEDIUM_CONFIDENCE, sources: [PROFILE_CATALOG_SOURCE],
      }));
    }

    if (task.intent === "propose-change") {
      const request = task.requestedChange;
      if (!request) return result(this.id, task, "La propuesta de perfil no contiene un cambio verificable.", findings);
      let previous: string | number | undefined;
      let valid = false;
      if (request.path === "component.systemIndex" && typeof request.value === "number") {
        previous = component.systemIndex;
        valid = Number.isInteger(request.value) && !!catalog[component.brand][request.value];
      } else if (request.path === "component.data.marco.profileCode" && typeof request.value === "string") {
        previous = component.data.marco.profileCode;
        valid = families.some((family) => family.code === request.value);
      } else {
        const match = request.path.match(/^component\.data\.tree\.leaf\.([^.]+)\.spec\.profileCode$/);
        const node = match ? findNode(component.data.tree, match[1]) : null;
        previous = node?.kind === "leaf" ? node.spec.profileCode : undefined;
        valid = typeof request.value === "string" && families.some((family) => family.code === request.value);
      }
      if (previous === undefined || !valid) {
        findings.push(finding({
          agentId: this.id, code: "PROFILE_CHANGE_REJECTED", severity: "error", title: "Perfil no confirmado",
          message: "El código o sistema solicitado no existe en el catálogo compatible. No se generó una propuesta.",
          path: request.path, blocking: true, confidence: BLOCKED_CONFIDENCE, sources: [PROFILE_CATALOG_SOURCE],
        }));
      } else {
        const dirtyPaths = propagateDirtyPaths([request.path]);
        const change = proposedChange(context, this.id, request.path, previous, request.value,
          "Selección comprobada contra el catálogo de perfiles del sistema.", HIGH_CONFIDENCE,
          [PROJECT_SOURCE, PROFILE_CATALOG_SOURCE], dirtyPaths);
        return result(this.id, task, "Profile Engineer preparó una selección de perfil verificable.", findings, [change], dirtyPaths);
      }
    }

    return result(this.id, task, findings.length ? "Profile Engineer encontró datos pendientes o incompatibles." : "Perfiles compatibles con el sistema.", findings);
  },
};
