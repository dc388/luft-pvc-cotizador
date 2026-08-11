import { catalog } from "@/data/catalog";
import { glassCatalog } from "@/data/glass";
import type { AgentContext, AgentTask, LuftAgent } from "../contracts";
import { BLOCKED_CONFIDENCE, HIGH_CONFIDENCE, MEDIUM_CONFIDENCE, finding, proposedChange, result } from "../contracts";
import { propagateDirtyPaths } from "../dependencies";
import { GLASS_CATALOG_SOURCE, PROJECT_SOURCE, SYSTEM_CATALOG_SOURCE } from "../sources";

export const glassEngineer: LuftAgent = {
  id: "glass-engineer",
  name: "Glass Engineer",
  role: "specialist",
  permissions: ["project:read", "component:review", "component:propose"],
  run(context: AgentContext, task: AgentTask) {
    const { component } = context;
    const system = catalog[component.brand][component.systemIndex];
    const glass = glassCatalog[component.data.glassIndex];
    const findings = [];
    if (!system || !glass) {
      findings.push(finding({
        agentId: this.id, code: "GLASS_INPUT_MISSING", severity: "error", title: "Configuración de vidrio incompleta",
        message: "El sistema o el vidrio seleccionado no existe en el catálogo actual.", path: "component.data.glassIndex",
        blocking: true, confidence: BLOCKED_CONFIDENCE, sources: [SYSTEM_CATALOG_SOURCE, GLASS_CATALOG_SOURCE],
      }));
      return result(this.id, task, "Glass Engineer quedó bloqueado por datos inexistentes.", findings);
    }

    if (glass.thickness > system.glazing) {
      findings.push(finding({
        agentId: this.id, code: "GLASS_REBATE_EXCEEDED", severity: "error", title: "Vidrio incompatible con el galce",
        message: `${glass.name} (${glass.thickness} mm) supera el galce de referencia de ${system.glazing} mm.`,
        path: "component.data.glassIndex", blocking: true, confidence: MEDIUM_CONFIDENCE,
        sources: [SYSTEM_CATALOG_SOURCE, GLASS_CATALOG_SOURCE],
      }));
    }
    if (glass.thickness <= 0 || glass.price <= 0) {
      findings.push(finding({
        agentId: this.id, code: "GLASS_CATALOG_INVALID", severity: "error", title: "Partida de vidrio inválida",
        message: "La partida seleccionada no tiene espesor o precio interno válido.", path: "component.data.glassIndex",
        blocking: true, confidence: HIGH_CONFIDENCE, sources: [GLASS_CATALOG_SOURCE],
      }));
    }
    findings.push(finding({
      agentId: this.id, code: "GLASS_SOURCE_REVIEW", severity: "warning", title: "Fuente comercial por confirmar",
      message: "La partida existe en el catálogo interno, pero no incluye proveedor, fecha de revisión ni certificado asociado.",
      path: "component.data.glassIndex", blocking: false, confidence: MEDIUM_CONFIDENCE, sources: [GLASS_CATALOG_SOURCE],
    }));

    if (task.intent === "propose-change") {
      const request = task.requestedChange;
      const nextGlass = request?.path === "component.data.glassIndex" && typeof request.value === "number"
        ? glassCatalog[request.value]
        : undefined;
      if (!request || !nextGlass || !Number.isInteger(request.value)) {
        findings.push(finding({
          agentId: this.id, code: "GLASS_CHANGE_REJECTED", severity: "error", title: "Vidrio no confirmado",
          message: "La partida solicitada no existe en el catálogo de vidrio.", path: request?.path,
          blocking: true, confidence: BLOCKED_CONFIDENCE, sources: [GLASS_CATALOG_SOURCE],
        }));
      } else if (nextGlass.thickness > system.glazing) {
        findings.push(finding({
          agentId: this.id, code: "GLASS_CHANGE_INCOMPATIBLE", severity: "error", title: "Cambio de vidrio bloqueado",
          message: `${nextGlass.name} supera el galce de ${system.glazing} mm del sistema actual.`, path: request.path,
          blocking: true, confidence: MEDIUM_CONFIDENCE, sources: [SYSTEM_CATALOG_SOURCE, GLASS_CATALOG_SOURCE],
        }));
      } else {
        const dirtyPaths = propagateDirtyPaths([request.path]);
        const change = proposedChange(context, this.id, request.path, component.data.glassIndex, request.value,
          "Partida existente y espesor compatible con el galce del sistema.", MEDIUM_CONFIDENCE,
          [PROJECT_SOURCE, GLASS_CATALOG_SOURCE, SYSTEM_CATALOG_SOURCE], dirtyPaths);
        return result(this.id, task, "Glass Engineer preparó un cambio de vidrio compatible.", findings, [change], dirtyPaths);
      }
    }

    return result(this.id, task, findings.some((item) => item.blocking) ? "Glass Engineer detectó una incompatibilidad." : "Vidrio compatible; procedencia comercial pendiente de confirmación.", findings);
  },
};
