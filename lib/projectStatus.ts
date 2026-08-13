import type { ProjectOrigin, ProjectStatus } from "@/types/project";

/** Etapas de un proyecto de cotización, en el orden en que avanza.
 *
 *  Como en QUOTE_STATUSES, es una lista de valores válidos y no una máquina de estados: el proceso
 *  real no es lineal (un proyecto aprobado se re-cotiza, uno rechazado se reabre), y restringir
 *  transiciones sin autenticación por usuario solo estorbaría.
 *
 *  "Archivado" NO está aquí a propósito: archivar es reversible y ortogonal a la etapa comercial.
 *  Si fuera un estado más, archivar un proyecto aprobado borraría el dato de que fue aprobado, y
 *  desarchivarlo no sabría a dónde volver. Vive en `projects.archivedAt`.
 */
export const PROJECT_STATUSES = ["draft", "in_progress", "quoted", "approved", "rejected"] as const;

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Borrador",
  in_progress: "En proceso",
  quoted: "Cotizado",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const INITIAL_PROJECT_STATUS: ProjectStatus = "draft";

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && (PROJECT_STATUSES as readonly string[]).includes(value);
}

export function projectStatusLabel(value: string): string {
  return isProjectStatus(value) ? PROJECT_STATUS_LABEL[value] : value;
}

export const PROJECT_ORIGINS = ["platform", "imported"] as const;

export const PROJECT_ORIGIN_LABEL: Record<ProjectOrigin, string> = {
  platform: "Creado en la plataforma",
  imported: "Importado",
};

export function isProjectOrigin(value: unknown): value is ProjectOrigin {
  return value === "platform" || value === "imported";
}

export function projectOriginLabel(value: string): string {
  return isProjectOrigin(value) ? PROJECT_ORIGIN_LABEL[value] : value;
}
