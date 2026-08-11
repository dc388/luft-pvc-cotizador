import { catalog } from "@/data/catalog";
import { glassCatalog } from "@/data/glass";
import { wingDefs } from "@/data/wings";
import { familiesForSystem } from "@/lib/profileMatch";
import { findNode } from "@/lib/tree";
import type { JsonValue } from "@/types/luft-ai";
import type { AgentContext, AgentTask } from "./contracts";
import { makeId } from "./contracts";

export type Interpretation =
  | { ok: true; task: AgentTask }
  | { ok: false; question: string };

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function proposal(prompt: string, path: string, value: JsonValue): Interpretation {
  return { ok: true, task: { id: makeId("task"), intent: "propose-change", prompt, requestedChange: { path, value } } };
}

function requestedNumber(text: string, label: string): number | null {
  const match = text.match(new RegExp(`${label}\\s*(?:a|de|=|:)?\\s*(\\d{2,6})`));
  return match ? Number(match[1]) : null;
}

// Safe local interpreter for Phase 1. It recognizes only bounded, testable intents and asks a
// question for everything else; it is deliberately not presented as an LLM or allowed to guess.
export function interpretPrompt(prompt: string, context: AgentContext): Interpretation {
  const text = normalize(prompt);
  if (!text) return { ok: false, question: "Escribe una revisión o un cambio técnico concreto." };
  if (/^(analiza|revisa|validar|valida|revision|diagnostico)/.test(text)) {
    return { ok: true, task: { id: makeId("task"), intent: "review", prompt } };
  }

  const width = requestedNumber(text, "ancho");
  if (width !== null) return proposal(prompt, "component.widthMm", width);
  const height = requestedNumber(text, "alto|altura");
  if (height !== null) return proposal(prompt, "component.heightMm", height);
  const qty = requestedNumber(text, "cantidad|piezas");
  if (qty !== null) return proposal(prompt, "component.qty", qty);

  if (text.includes("sistema")) {
    const systems = catalog[context.component.brand]
      .map((system, index) => ({ system, index }))
      .filter(({ system }) => text.includes(normalize(system.name)));
    if (systems.length === 1) return proposal(prompt, "component.systemIndex", systems[0].index);
    return { ok: false, question: `Indica el nombre exacto de un sistema ${context.component.brand}.` };
  }

  if (text.includes("vidrio") || text.includes("cristal") || text.includes("dvh")) {
    const glasses = glassCatalog
      .map((glass, index) => ({ glass, index }))
      .filter(({ glass }) => text.includes(normalize(glass.name)));
    if (glasses.length === 1) return proposal(prompt, "component.data.glassIndex", glasses[0].index);
    return { ok: false, question: "Indica el nombre completo de una partida del catálogo de vidrio." };
  }

  const selectedId = context.component.data.selectedId;
  const selected = findNode(context.component.data.tree, selectedId);
  if (selected?.kind === "leaf" && (text.includes("hoja seleccionada") || text.includes(`hoja ${normalize(selectedId)}`))) {
    const wings = wingDefs.filter((wing) => text.includes(normalize(wing.name)) || text.includes(wing.id));
    if (wings.length === 1) return proposal(prompt, `component.data.tree.leaf.${selectedId}.wing`, wings[0].id);
  }

  if (text.includes("perfil")) {
    const system = catalog[context.component.brand][context.component.systemIndex];
    const families = system ? familiesForSystem(context.component.brand, system.name) : [];
    const matches = families.filter((family) => text.includes(normalize(family.code)));
    if (matches.length === 1) {
      const path = text.includes("marco")
        ? "component.data.marco.profileCode"
        : `component.data.tree.leaf.${selectedId}.spec.profileCode`;
      return proposal(prompt, path, matches[0].code);
    }
    return { ok: false, question: "Indica un código exacto del catálogo compatible y si corresponde al marco o a la hoja seleccionada." };
  }

  if (text.includes("herraje")) {
    return { ok: false, question: "El catálogo técnico de herrajes aún no está cargado; puedo revisar el componente, pero no inventar una selección." };
  }

  return { ok: false, question: "Puedo revisar el componente o proponer ancho, alto, cantidad, sistema, vidrio, tipología de la hoja seleccionada y códigos de perfil confirmados." };
}
