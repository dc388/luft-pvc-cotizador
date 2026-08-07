import type {
  FrameNode,
  GlassSide,
  GlassSides,
  LeafNode,
  Marco,
  PaneSpec,
  Side,
  Sides,
  WingType,
} from "@/types/domain";
import { wingDefs } from "@/data/wings";

const OPENING_BY_WING: Record<WingType, string> = {
  fixed: "Sin apertura",
  sliding: "Corredera",
  "lift-slide": "Corredera elevadora",
  "folding-sliding": "Plegable corrediza",
  "sliding-fixed": "Corredera fija (sin apertura)",
  "casement-in": "Abatible interior",
  "casement-out": "Abatible exterior",
  "tilt-turn": "Oscilobatiente",
  project: "Proyectante",
  hopper: "Proyectante inferior",
  jalousie: "Persiana de cristal",
  pivot: "Pivotante",
  door: "Abatible interior",
  inactive: "Sin apertura",
};

const HARDWARE_BY_WING: Partial<Record<WingType, string>> = {
  "lift-slide": "Roto · sistema elevador (lift-slide)",
  pivot: "Bisagra pivote reforzada",
};
const HANDLE_BY_WING: Partial<Record<WingType, string>> = {
  jalousie: "Manivela jalousie",
};

// Movable sliding-family wings only -- a "corredera fija" leaf sits in the same track group
// visually (no travesaño between it and its movable siblings, see SLIDING_WINGS in lib/calc.ts
// and components/editor) but has no rollers/handle/adapter of its own, so it's excluded here.
export const MOVABLE_SLIDING_WINGS: WingType[] = ["sliding", "lift-slide", "folding-sliding"];

// Every wing in the sliding family, including the non-movable "corredera fija" variant --
// used wherever a shared-track visual rule applies (no structural mullion between neighbors).
export const SLIDING_WINGS: WingType[] = ["sliding", "lift-slide", "folding-sliding", "sliding-fixed"];

export const SIDE_LABEL: Record<keyof Sides, string> = { top: "Arriba", bottom: "Abajo", left: "Izquierda", right: "Derecha" };

// A "fixed"/"inactive" leaf glazes straight into the frame/mullion -- no hoja (sash) profile of
// its own, matching the shapes drawn by FrameNodeView and cut by buildCutList in lib/calc.ts.
export function hasSashWing(wing: WingType): boolean {
  return wing !== "fixed" && wing !== "inactive";
}

// A wing with hardware/handle of its own -- excludes "fixed"/"inactive" (no sash at all) and
// "sliding-fixed" (has a sash but no rollers/handle, see MOVABLE_SLIDING_WINGS above).
export function isOperableWing(wing: WingType): boolean {
  return hasSashWing(wing) && wing !== "sliding-fixed";
}

export function defaultSpecFor(wing: WingType): Partial<PaneSpec> {
  const fixed = wing === "fixed" || wing === "inactive" || wing === "sliding-fixed";
  const movableSliding = MOVABLE_SLIDING_WINGS.includes(wing);
  return {
    state: wing === "inactive" ? "Inactiva" : fixed ? "Fija" : "Móvil",
    opening: OPENING_BY_WING[wing],
    direction: movableSliding ? "Derecha" : "N/A",
    hardware: fixed ? "Sin herraje" : HARDWARE_BY_WING[wing] ?? "Roto · cierre multipunto",
    handle: fixed ? "Sin manilla" : HANDLE_BY_WING[wing] ?? "Harmony con tetones",
    handlePosition: fixed ? 0 : 1000,
    pocketType: movableSliding ? "Ninguno" : "N/A",
    useGancho: movableSliding,
    useAdaptador: movableSliding,
  };
}

function defaultSide(): Side {
  return { reinforcement: false, notes: "" };
}

export function defaultSides(): Sides {
  return { top: defaultSide(), bottom: defaultSide(), left: defaultSide(), right: defaultSide() };
}

function defaultGlassSide(): GlassSide {
  // 45°/45° = miter of a standard rectangular pane corner, matching what RA Workshop
  // shows for a plain rectangular glass side (radio/arco only matter for shaped glass).
  return { angulo1: 45, angulo2: 45, radio: 0, arco: 0, notes: "" };
}

export function defaultGlassSides(): GlassSides {
  return { top: defaultGlassSide(), bottom: defaultGlassSide(), left: defaultGlassSide(), right: defaultGlassSide() };
}

export function defaultMarco(): Marco {
  return {
    profileCode: "",
    reinforcement: false,
    reinforcementCode: "",
    mosquitero: false,
    mosquiteroCode: "",
    persiana: false,
    persianaCode: "",
    sides: defaultSides(),
  };
}

export function createLeaf(wing: WingType = "fixed", spec?: Partial<PaneSpec>, id: string = crypto.randomUUID()): LeafNode {
  return {
    kind: "leaf",
    id,
    wing,
    spec: {
      glass: "Heredar vidrio general",
      notes: "",
      mallorquina: false,
      sides: defaultSides(),
      glassSides: defaultGlassSides(),
      ...defaultSpecFor(wing),
      ...spec,
    } as PaneSpec,
  };
}

// Default starting shape for a new item: a 2-panel sliding window, the most
// common opening — the same idea as the app's old "slide2" preset default.
//
// Uses fixed ids instead of crypto.randomUUID() so this tree is identical
// between server and client renders (no React hydration mismatch). Every
// mutation made after mount (split, add, reset, etc.) still gets a random id.
export function createDefaultTree(): FrameNode {
  return {
    kind: "split",
    id: "root",
    axis: "col",
    ratios: [0.5, 0.5],
    children: [
      createLeaf("sliding", undefined, "leaf-a"),
      createLeaf("sliding", { direction: "Izquierda" }, "leaf-b"),
    ],
  };
}

export function isLeaf(node: FrameNode): node is LeafNode {
  return node.kind === "leaf";
}

export function firstLeafId(tree: FrameNode): string {
  return tree.kind === "leaf" ? tree.id : firstLeafId(tree.children[0]);
}

export function findNode(tree: FrameNode, id: string): FrameNode | null {
  if (tree.id === id) return tree;
  if (tree.kind === "split") {
    for (const child of tree.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

export function findParentSplitId(tree: FrameNode, childId: string): string | null {
  if (tree.kind !== "split") return null;
  if (tree.children.some((c) => c.id === childId)) return tree.id;
  for (const child of tree.children) {
    const found = findParentSplitId(child, childId);
    if (found) return found;
  }
  return null;
}

export function walkLeaves(tree: FrameNode): LeafNode[] {
  if (tree.kind === "leaf") return [tree];
  return tree.children.flatMap(walkLeaves);
}

function mapLeaf(tree: FrameNode, id: string, fn: (leaf: LeafNode) => FrameNode): FrameNode {
  if (tree.id === id) return tree.kind === "leaf" ? fn(tree) : tree;
  if (tree.kind === "split") return { ...tree, children: tree.children.map((c) => mapLeaf(c, id, fn)) };
  return tree;
}

// Splits the leaf at `id` into two children along `axis`, at the fraction
// (0-1) of the click position. Both children inherit the original spec/wing.
export function splitLeaf(tree: FrameNode, id: string, axis: "row" | "col", fraction: number): FrameNode {
  const f = Math.min(0.85, Math.max(0.15, fraction));
  return mapLeaf(tree, id, (leaf) => ({
    kind: "split",
    id: leaf.id,
    axis,
    ratios: [f, 1 - f],
    children: [
      { ...leaf, id: crypto.randomUUID() },
      { ...leaf, id: crypto.randomUUID() },
    ],
  }));
}

export function setWing(tree: FrameNode, id: string, wing: WingType): FrameNode {
  return mapLeaf(tree, id, (leaf) => ({ ...leaf, wing, spec: { ...leaf.spec, ...defaultSpecFor(wing) } }));
}

export function updateSpec(tree: FrameNode, id: string, patch: Partial<PaneSpec>): FrameNode {
  return mapLeaf(tree, id, (leaf) => ({ ...leaf, spec: { ...leaf.spec, ...patch } }));
}

export function updateSide(tree: FrameNode, id: string, side: keyof Sides, patch: Partial<Side>): FrameNode {
  return mapLeaf(tree, id, (leaf) => ({
    ...leaf,
    spec: { ...leaf.spec, sides: { ...leaf.spec.sides, [side]: { ...leaf.spec.sides[side], ...patch } } },
  }));
}

export function updateGlassSide(tree: FrameNode, id: string, side: keyof GlassSides, patch: Partial<GlassSide>): FrameNode {
  return mapLeaf(tree, id, (leaf) => ({
    ...leaf,
    spec: { ...leaf.spec, glassSides: { ...leaf.spec.glassSides, [side]: { ...leaf.spec.glassSides[side], ...patch } } },
  }));
}

export function updateMarco(marco: Marco, patch: Partial<Marco>): Marco {
  return { ...marco, ...patch };
}

export function updateMarcoSide(marco: Marco, side: keyof Sides, patch: Partial<Side>): Marco {
  return { ...marco, sides: { ...marco.sides, [side]: { ...marco.sides[side], ...patch } } };
}

// Collapses a split back into a single leaf, keeping the first leaf child's
// wing/spec. Only meaningful when both children are leaves (see canMerge in
// app/page.tsx) — collapsing a split with a sub-tree child would discard it.
export function removeSplit(tree: FrameNode, splitId: string): FrameNode {
  function walk(node: FrameNode): FrameNode {
    if (node.kind !== "split") return node;
    if (node.id === splitId) {
      const base = (node.children.find(isLeaf) as LeafNode | undefined) ?? createLeaf();
      return { kind: "leaf", id: node.id, wing: base.wing, spec: base.spec };
    }
    return { ...node, children: node.children.map(walk) };
  }
  return walk(tree);
}

export type Rect = { id: string; wing: WingType; spec: PaneSpec; x: number; y: number; w: number; h: number };

// Resolves the tree's ratios into absolute mm rectangles for a given overall
// width/height — used by the calc engine and by report tables.
export function flattenToRects(tree: FrameNode, width: number, height: number, x = 0, y = 0): Rect[] {
  if (tree.kind === "leaf") return [{ id: tree.id, wing: tree.wing, spec: tree.spec, x, y, w: width, h: height }];
  const rects: Rect[] = [];
  let offset = 0;
  tree.children.forEach((child, i) => {
    const ratio = tree.ratios[i];
    if (tree.axis === "col") {
      const w = width * ratio;
      rects.push(...flattenToRects(child, w, height, x + offset, y));
      offset += w;
    } else {
      const h = height * ratio;
      rects.push(...flattenToRects(child, width, h, x, y + offset));
      offset += h;
    }
  });
  return rects;
}

export function isSlidingLeaf(node: FrameNode): boolean {
  return node.kind === "leaf" && SLIDING_WINGS.includes(node.wing);
}

export function wingName(wing: WingType): string {
  return wingDefs.find((w) => w.id === wing)?.name ?? wing;
}

// Glyph shown in the middle of a leaf's own hoja hit area: an arrow for movable sliding
// wings (direction-dependent), "FIJO" for anything that doesn't open, otherwise the wing's
// own toolbox icon.
export function motionGlyph(wing: WingType, direction: string): string {
  if (MOVABLE_SLIDING_WINGS.includes(wing)) return direction === "Izquierda" ? "←" : "→";
  if (wing === "fixed" || wing === "inactive" || wing === "sliding-fixed") return "FIJO";
  return wingDefs.find((w) => w.id === wing)?.icon ?? "?";
}
