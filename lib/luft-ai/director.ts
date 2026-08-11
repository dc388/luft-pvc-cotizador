import type { AgentFinding } from "@/types/luft-ai";
import type { AgentContext, AgentTask, LuftAgent } from "./contracts";
import { BLOCKED_CONFIDENCE, finding, result } from "./contracts";
import { hasPermission } from "./permissions";
import { designEngineer } from "./agents/designEngineer";
import { glassEngineer } from "./agents/glassEngineer";
import { hardwareEngineer } from "./agents/hardwareEngineer";
import { profileEngineer } from "./agents/profileEngineer";

const SPECIALISTS = [designEngineer, profileEngineer, glassEngineer, hardwareEngineer];

function specialistFor(path: string): LuftAgent | null {
  if (path === "component.data.glassIndex") return glassEngineer;
  if (path === "component.systemIndex" || path.includes("profileCode")) return profileEngineer;
  if (path.includes(".spec.hardware")) return hardwareEngineer;
  if (path === "component.widthMm" || path === "component.heightMm" || path === "component.qty" || path.includes(".wing")) return designEngineer;
  return null;
}

function forbiddenFinding(task: AgentTask, message: string): AgentFinding {
  return finding({
    agentId: "luft-director",
    code: "DIRECTOR_FORBIDDEN",
    severity: "error",
    title: "Acción no autorizada",
    message,
    blocking: true,
    confidence: BLOCKED_CONFIDENCE,
    sources: [{ kind: "project-data", reference: `Tarea ${task.id}` }],
  });
}

export const luftDirector: LuftAgent = {
  id: "luft-director",
  name: "LUFT Director",
  role: "orchestrator",
  permissions: ["project:read", "component:review", "component:propose", "component:approve"],
  run(context: AgentContext, task: AgentTask) {
    const permission = task.intent === "review" ? "component:review" : "component:propose";
    if (!hasPermission(context.actor.role, permission)) {
      const denied = forbiddenFinding(task, `El rol ${context.actor.role} no tiene el permiso ${permission}.`);
      return result(this.id, task, denied.message, [denied]);
    }

    if (task.intent === "review") {
      const specialistResults = SPECIALISTS.map((agent) => agent.run(context, task));
      const findings = specialistResults.flatMap((agentResult) => agentResult.payload?.findings ?? agentResult.validationErrors);
      const changes = specialistResults.flatMap((agentResult) => agentResult.payload?.changes ?? []);
      const dirtyPaths = [...new Set(specialistResults.flatMap((agentResult) => agentResult.payload?.dirtyPaths ?? []))];
      const blocking = findings.filter((item) => item.blocking).length;
      const summary = blocking
        ? `LUFT Director completó la revisión con ${blocking} bloqueo(s) técnico(s).`
        : findings.length
          ? `LUFT Director completó la revisión con ${findings.length} observación(es).`
          : "LUFT Director completó la revisión técnica sin observaciones.";
      return result(this.id, task, summary, findings, changes, dirtyPaths);
    }

    const path = task.requestedChange?.path;
    const specialist = path ? specialistFor(path) : null;
    if (!specialist) {
      const unsupported = finding({
        agentId: this.id,
        code: "DIRECTOR_SCOPE_UNSUPPORTED",
        severity: "error",
        title: "Cambio fuera del alcance de Fase 1",
        message: "La solicitud no corresponde a diseño, perfiles, vidrio o herrajes con una ruta conocida.",
        path,
        blocking: true,
        confidence: BLOCKED_CONFIDENCE,
        sources: [{ kind: "missing", reference: "Agente especialista para la ruta solicitada" }],
      });
      return result(this.id, task, unsupported.message, [unsupported]);
    }

    const delegated = specialist.run(context, task);
    const findings = delegated.payload?.findings ?? delegated.validationErrors;
    const changes = delegated.payload?.changes ?? [];
    const dirtyPaths = delegated.payload?.dirtyPaths ?? [];
    return result(this.id, task,
      changes.length ? `LUFT Director delegó la solicitud a ${specialist.name}; la propuesta espera aprobación.` : `LUFT Director consultó a ${specialist.name}, pero no generó un cambio aplicable.`,
      findings, changes, dirtyPaths);
  },
};
