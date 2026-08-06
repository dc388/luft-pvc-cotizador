import type { WingType } from "@/types/domain";

export type WingDef = { id: WingType; name: string; icon: string; group: string };

// Toolbox palette of assignable opening types, modeled on RA Workshop's "Wings" category.
export const wingDefs: WingDef[] = [
  { id: "fixed", name: "Fijo", icon: "▣", group: "Ventana" },
  { id: "sliding", name: "Corrediza", icon: "⇆", group: "Corredera" },
  { id: "casement-in", name: "Abatible interior", icon: "◩", group: "Practicable" },
  { id: "casement-out", name: "Abatible exterior", icon: "◪", group: "Practicable" },
  { id: "tilt-turn", name: "Oscilobatiente", icon: "⌂", group: "Practicable" },
  { id: "project", name: "Proyectante", icon: "▽", group: "Practicable" },
  { id: "door", name: "Puerta abatible", icon: "▥", group: "Puerta" },
  { id: "inactive", name: "Inactiva", icon: "—", group: "Especial" },
];
