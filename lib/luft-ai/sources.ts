import type { SourceEvidence } from "@/types/luft-ai";

export const PROJECT_SOURCE: SourceEvidence = {
  kind: "project-data",
  reference: "Componente persistido del proyecto",
};

export const TREE_ENGINE_SOURCE: SourceEvidence = {
  kind: "deterministic-engine",
  reference: "lib/tree.ts",
};

export const CALC_ENGINE_SOURCE: SourceEvidence = {
  kind: "deterministic-engine",
  reference: "lib/calc.ts",
};

export const SYSTEM_CATALOG_SOURCE: SourceEvidence = {
  kind: "verified-catalog",
  reference: "data/catalog.ts",
  note: "La procedencia comercial varía por sistema; revisar la bandera sourced.",
};

export const PROFILE_CATALOG_SOURCE: SourceEvidence = {
  kind: "verified-catalog",
  reference: "data/families.ts · Aluplast EXWORK Veracruz ABR_22",
};

export const GLASS_CATALOG_SOURCE: SourceEvidence = {
  kind: "estimate",
  reference: "data/glass.ts",
  note: "Catálogo interno sin metadatos de proveedor/revisión por partida.",
};

export const WING_CATALOG_SOURCE: SourceEvidence = {
  kind: "project-data",
  reference: "data/wings.ts",
};

export const MISSING_HARDWARE_SOURCE: SourceEvidence = {
  kind: "missing",
  reference: "Catálogo técnico de herrajes no disponible",
};
