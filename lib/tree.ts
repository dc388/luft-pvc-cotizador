import type { FrameNode, LeafNode, PaneSpec, WingType } from "@/types/domain";

const OPENING_BY_WING: Record<WingType, string> = {
  fixed: "Sin apertura",
  sliding: "Corredera",
  "casement-in": "Abatible interior",
  "casement-out": "Abatible exterior",
  "tilt-turn": "Oscilobatiente",
  project: "Proyectante",
  door: "Abatible interior",
  inactive: "Sin apertura",
};

export function defaultSpecFor(wing: WingType): Partial<PaneSpec> {
  const fixed = wing === "fixed" || wing === "inactive";
  return {
    state: wing === "inactive" ? "Inactiva" : fixed ? "Fija" : "Móvil",
    opening: OPENING_BY_WING[wing],
    direction: wing === "sliding" ? "Derecha" : "N/A",
    hardware: fixed ? "Sin herraje" : "Roto · cierre multipunto",
    handle: fixed ? "Sin manilla" : "Harmony con tetones",
  };
}

export function createLeaf(wing: WingType = "fixed", spec?: Partial<PaneSpec>): LeafNode {
  return {
    kind: "leaf",
    id: crypto.randomUUID(),
    wing,
    spec: { ...defaultSpecFor(wing), glass: "Heredar vidrio general", notes: "", ...spec } as PaneSpec,
  };
}

// Default starting shape for a new item: a 2-panel sliding window, the most
// common opening — the same idea as the app's old "slide2" preset default.
export function createDefaultTree(): FrameNode {
  return {
    kind: "split",
    id: crypto.randomUUID(),
    axis: "col",
    ratios: [0.5, 0.5],
    children: [createLeaf("sliding"), createLeaf("sliding", { direction: "Izquierda" })],
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
