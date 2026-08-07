import type { WingType } from "@/types/domain";

export type WingDef = { id: WingType; name: string; icon: string; group: string; isNew?: boolean };

// Toolbox palette of assignable opening types, modeled on RA Workshop's "Wings" category.
// The 5 marked isNew were added after researching real systems found in the Aluplast price
// list (ELEVADORA 70MM -> lift-slide) and a broader fenestration-industry survey
// (hopper/jalousie/pivot/folding-sliding).
export const wingDefs: WingDef[] = [
  { id: "fixed", name: "Fijo", icon: "▣", group: "Ventana" },
  { id: "sliding", name: "Corrediza", icon: "⇆", group: "Corredera" },
  { id: "lift-slide", name: "Corredera elevadora", icon: "⇑", group: "Corredera", isNew: true },
  { id: "folding-sliding", name: "Plegable corrediza", icon: "»", group: "Corredera", isNew: true },
  { id: "sliding-fixed", name: "Corredera fija", icon: "⇹", group: "Corredera", isNew: true },
  { id: "casement-in", name: "Abatible interior", icon: "◩", group: "Practicable" },
  { id: "casement-out", name: "Abatible exterior", icon: "◪", group: "Practicable" },
  { id: "tilt-turn", name: "Oscilobatiente", icon: "⌂", group: "Practicable" },
  { id: "project", name: "Proyectante", icon: "▽", group: "Practicable" },
  { id: "hopper", name: "Proyectante inferior", icon: "△", group: "Practicable", isNew: true },
  { id: "jalousie", name: "Persiana de cristal", icon: "☰", group: "Especial", isNew: true },
  { id: "pivot", name: "Pivotante", icon: "↻", group: "Especial", isNew: true },
  { id: "door", name: "Puerta abatible", icon: "▥", group: "Puerta" },
  { id: "inactive", name: "Inactiva", icon: "—", group: "Especial" },
];
