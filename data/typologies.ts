import type { FrameNode } from "@/types/domain";
import { createLeaf } from "@/lib/tree";
import { newId } from "@/lib/uuid";

export type TypologyDef = {
  id: string;
  name: string;
  icon: string;
  description: string;
  build: () => FrameNode;
};

function splitCol(children: FrameNode[], ratios?: number[]): FrameNode {
  const n = children.length;
  return { kind: "split", id: newId(), axis: "col", ratios: ratios ?? Array(n).fill(1 / n), children };
}
function splitRow(children: FrameNode[], ratios?: number[]): FrameNode {
  const n = children.length;
  return { kind: "split", id: newId(), axis: "row", ratios: ratios ?? Array(n).fill(1 / n), children };
}

// Biblioteca original de tipologías Luft PVC: seleccionar una construye el árbol real
// (splits + wings + specs vía lib/tree.ts), no solo cambia una imagen -- cada build() usa el
// mismo motor que el Toolbox manual, así que el resultado es indistinguible de haberlo armado
// a mano hoja por hoja. Nombres, iconos y agrupación son propios de Luft PVC.
export const typologyDefs: TypologyDef[] = [
  { id: "fijo-1", name: "Fijo", icon: "▭", description: "Un solo panel fijo, sin apertura.", build: () => createLeaf("fixed") },
  { id: "corr-1", name: "Corrediza · 1 hoja", icon: "▭⇢", description: "Una hoja corrediza sobre un riel.", build: () => createLeaf("sliding") },
  {
    id: "corr-2-moviles",
    name: "Corrediza · 2 hojas móviles",
    icon: "⇠▭▭⇢",
    description: "Dos hojas corredizas, cada una se desliza hacia el centro.",
    build: () => splitCol([createLeaf("sliding", { direction: "Derecha" }), createLeaf("sliding", { direction: "Izquierda" })]),
  },
  {
    id: "corr-2-fija-movil",
    name: "Corrediza · fija + móvil",
    icon: "▭│▭⇠",
    description: "Un panel fijo y uno corredizo que se desliza hacia él.",
    build: () => splitCol([createLeaf("sliding-fixed"), createLeaf("sliding", { direction: "Izquierda" })]),
  },
  {
    id: "corr-3",
    name: "Corrediza · 3 hojas",
    icon: "▭▭▭",
    description: "Fija-móvil-fija: la composición de 3 paños más común.",
    build: () => splitCol([createLeaf("sliding-fixed"), createLeaf("sliding"), createLeaf("sliding-fixed")]),
  },
  {
    id: "corr-4",
    name: "Corrediza · 4 hojas",
    icon: "▭▭▭▭",
    description: "Dos pares de hojas corredizas que se encuentran al centro (requiere 2-3 rieles).",
    build: () =>
      splitCol([
        createLeaf("sliding", { direction: "Derecha" }),
        createLeaf("sliding", { direction: "Izquierda" }),
        createLeaf("sliding", { direction: "Derecha" }),
        createLeaf("sliding", { direction: "Izquierda" }),
      ]),
  },
  { id: "abatible", name: "Abatible", icon: "◧", description: "Una hoja que abre hacia afuera sobre bisagras.", build: () => createLeaf("casement-out") },
  { id: "oscilo", name: "Oscilobatiente", icon: "◨", description: "Abre en abanico o bascula desde arriba, según manilla.", build: () => createLeaf("tilt-turn") },
  { id: "proyectante", name: "Proyectante", icon: "◭", description: "Bascula desde el marco superior hacia afuera.", build: () => createLeaf("project") },
  { id: "puerta-1", name: "Puerta · 1 hoja", icon: "▯", description: "Puerta abatible de una sola hoja.", build: () => createLeaf("door") },
  {
    id: "puerta-2",
    name: "Puerta · 2 hojas",
    icon: "▯▯",
    description: "Dos hojas de puerta abatibles.",
    build: () => splitCol([createLeaf("door"), createLeaf("door")]),
  },
  {
    id: "combinado-fijo-corr",
    name: "Combinado · fijo + corrediza",
    icon: "▭╱▭▭",
    description: "Panel fijo superior sobre una corredera de 2 hojas.",
    build: () =>
      splitRow(
        [createLeaf("fixed"), splitCol([createLeaf("sliding", { direction: "Derecha" }), createLeaf("sliding", { direction: "Izquierda" })])],
        [0.35, 0.65]
      ),
  },
];
