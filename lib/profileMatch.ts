import type { Brand, ProfileFamily } from "@/types/domain";
import { profileFamilies } from "@/data/families";

// Maps a catalog System.name (data/catalog.ts) to the family-group key(s) it corresponds to
// in data/families.ts's 278-row Aluplast catalog (see that file's own grouping, e.g.
// "CORREDERA 60MM"). An empty array means there is no real per-profile data sourced for that
// system yet -- callers must show "Dato técnico pendiente", never invent codes/prices for it
// (see Fase 5 rule in the project brief: no inventar precios ni datos técnicos).
const ALUPLAST_SYSTEM_TO_FAMILY_GROUPS: Record<string, string[]> = {
  "CORREDERA 60MM": ["CORREDERA 60MM"],
  "CORREDERA 60MM · Monorriel": ["CORREDERA 60MM - MONORRIEL"],
  "CORREDERA 96MM": ["CORREDERA 96MM"],
  "IDEAL 2000 · Practicable": ["IDEAL 2000"],
  "IDEAL 2000 Classic-line · Fijo": ["IDEAL 2000"],
  "IDEAL 2000 · Puerta interior/exterior": ["IDEAL 2000"],
  "ELEVADORA 70MM · Corredera elevable": ["ELEVADORA 70MM"],
  // No family rows sourced for these yet -- IDEAL 4000/7000/8000, neo smart-slide, Lift-slide 85.
};

// Deceuninck has zero rows in data/families.ts today (confirmed by the codebase audit) --
// there is no real per-profile catalog for it yet, for any system.
export function familiesForSystem(brand: Brand, systemName: string): ProfileFamily[] {
  if (brand !== "Aluplast") return [];
  const groups = ALUPLAST_SYSTEM_TO_FAMILY_GROUPS[systemName];
  if (!groups || groups.length === 0) return [];
  return profileFamilies.filter((f) => groups.includes(f.system));
}
