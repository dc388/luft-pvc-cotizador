import type {
  FrameNode,
  GlassSide,
  GlassSides,
  LeafNode,
  Marco,
  PaneSpec,
  Side,
  Sides,
  System,
  WingType,
} from "@/types/domain";
import { wingDefs } from "@/data/wings";
import { leafSizingFor } from "@/data/glazing";
import { newId } from "@/lib/uuid";

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

export function defaultSpecFor(wing: WingType): Partial<PaneSpec> {
  const fixed = wing === "fixed" || wing === "inactive" || wing === "sliding-fixed";
  const movableSliding = MOVABLE_SLIDING_WINGS.includes(wing);
  const sliding = SLIDING_WINGS.includes(wing);
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
    railIndex: sliding ? 1 : 0,
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

export function createLeaf(wing: WingType = "fixed", spec?: Partial<PaneSpec>): LeafNode {
  return {
    kind: "leaf",
    id: newId(),
    wing,
    spec: {
      glass: "Heredar vidrio general",
      notes: "",
      mallorquina: false,
      profileCode: "",
      sides: defaultSides(),
      glassSides: defaultGlassSides(),
      ...defaultSpecFor(wing),
      ...spec,
    } as PaneSpec,
  };
}

// Default starting shape for a new item: a 2-panel sliding window, the most
// common opening — the same idea as the app's old "slide2" preset default.
// Fixed ids (not newId()): this tree is built inside a useState
// initializer that runs once during SSR and again during client hydration —
// random ids would differ between the two passes and React would flag a
// hydration mismatch on every load.
export function createDefaultTree(): FrameNode {
  return {
    kind: "split",
    id: "default-root",
    axis: "col",
    ratios: [0.5, 0.5],
    children: [
      { ...createLeaf("sliding"), id: "default-leaf-a" },
      { ...createLeaf("sliding", { direction: "Izquierda" }), id: "default-leaf-b" },
    ],
  };
}

export function isLeaf(node: FrameNode): node is LeafNode {
  return node.kind === "leaf";
}

// Backfills fields added to PaneSpec after some trees were already persisted (DB or offline
// localStorage) -- without this, a leaf loaded from an older save has spec.profileCode/
// railIndex as `undefined`, which silently breaks anything that does arithmetic on railIndex
// (e.g. Array.from({length: Math.max(rail, undefined)}) -> NaN -> empty options). Idempotent:
// a leaf that already has both fields set passes through unchanged.
export function normalizeTree(tree: FrameNode): FrameNode {
  if (tree.kind === "leaf") {
    if (tree.spec.profileCode !== undefined && tree.spec.railIndex !== undefined) return tree;
    return {
      ...tree,
      spec: {
        ...tree.spec,
        profileCode: tree.spec.profileCode ?? "",
        railIndex: tree.spec.railIndex ?? (SLIDING_WINGS.includes(tree.wing) ? 1 : 0),
      },
    };
  }
  return { ...tree, children: tree.children.map(normalizeTree) };
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
      { ...leaf, id: newId() },
      { ...leaf, id: newId() },
    ],
  }));
}

export function setWing(tree: FrameNode, id: string, wing: WingType): FrameNode {
  return mapLeaf(tree, id, (leaf) => ({ ...leaf, wing, spec: { ...leaf.spec, ...defaultSpecFor(wing) } }));
}

// Which opening/leaf types a system can physically host, derived from its real catalog data
// (rails -- whether it has any sliding track at all -- and category for the Fijo/Puerta
// special cases) instead of a hand-maintained per-system list. Used to keep the "Tipo de
// apertura" picker and the Toolbox wing palette from ever offering (or silently keeping) a
// combination no real profile supports, e.g. a "Corrediza" leaf on a Practicable-only system.
export function allowedWingsFor(sys: System): WingType[] {
  if (sys.category === "Fijo") return ["fixed", "inactive"];
  if (sys.category === "Puerta") return ["door", "fixed", "inactive"];
  const slidingCapable = sys.rails.some((r) => r > 0);
  return slidingCapable
    ? ["fixed", "inactive", "sliding", "lift-slide", "folding-sliding", "sliding-fixed"]
    : ["fixed", "inactive", "casement-in", "casement-out", "tilt-turn", "project", "hopper", "jalousie", "pivot"];
}

// Remaps any leaf whose wing isn't in `allowed` to a sensible default for the new system --
// called when the active brand/System changes so an existing corredera leaf can't survive
// under a profile with no sliding track (and vice versa). Picks the first non-fixed allowed
// wing so a 2-leaf sliding default becomes a 2-leaf casement default, etc.
export function remapTreeToSystem(tree: FrameNode, allowed: WingType[]): FrameNode {
  if (!allowed.length) return tree;
  const fallback = allowed.find((w) => w !== "fixed" && w !== "inactive") ?? allowed[0];
  function walk(node: FrameNode): FrameNode {
    if (node.kind === "split") return { ...node, children: node.children.map(walk) };
    if (allowed.includes(node.wing)) return node;
    return { ...node, wing: fallback, spec: { ...node.spec, ...defaultSpecFor(fallback) } };
  }
  return walk(tree);
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

// Shared with components/editor/frameTypes.ts (re-exported from there for the editor's
// hit-testing UI) -- "overlap" marks a shared boundary between two sliding leaves that
// meet mid-run, `true` marks a boundary against the real outer marco, `false` an internal
// structural mullion/travesaño between non-sliding neighbors.
export type EdgeValue = boolean | "overlap";
export type Edges = { top: EdgeValue; right: EdgeValue; bottom: EdgeValue; left: EdgeValue };
const OUTER_EDGES: Edges = { top: true, right: true, bottom: true, left: true };

export type LeafFrame = Rect & {
  edges: Edges;
  // Real fabrication rect: for sliding leaves, inset by `seatMm` on every side that seats
  // into the outer marco, and extended by half of `overlapMm` on every side that overlaps a
  // sliding sibling at a shared track boundary -- see System.frameSeatMm/centerOverlapMm.
  // Equal to x/y/w/h for any non-sliding leaf (fixed, casement, etc.), unchanged from today.
  fabX: number;
  fabY: number;
  fabW: number;
  fabH: number;
};

// Resolves the tree into absolute mm rectangles like flattenToRects, but also carries each
// leaf's real fabrication size once sliding leaves' marco-seat and center-traslape are
// accounted for -- used by the cut list, the quote's sash measurements, and the editor's
// drawing (which renders fabX/fabY/fabW/fabH so overlapping sliding leaves visually overlap).
export function flattenToLeafFrames(
  tree: FrameNode,
  width: number,
  height: number,
  sys: System,
  edges: Edges = OUTER_EDGES,
  x = 0,
  y = 0
): LeafFrame[] {
  // Un sistema con descuento de hoja documentado en su ficha manda sobre el modelo genérico. Sin
  // entrada en data/glazing.ts esto es `null` y todo sigue por el camino de siempre
  // (frameSeatMm/centerOverlapMm), byte por byte: es lo que permite añadir sistemas calibrados sin
  // mover ni un milímetro de los que ya estaban.
  const sizing = leafSizingFor(sys.name);
  const seatMm = sys.frameSeatMm, overlapMm = sys.centerOverlapMm;
  if (tree.kind === "leaf" && sizing) {
    // Una hoja MOVIL y un CAMPO FIJO no descuentan lo mismo. En la ventana IS coinciden, y por eso
    // durante un dia basto un solo par de numeros; en la puerta IS no: la hoja corredera descuenta
    // 157,8 mm de alto y el campo fijo 56,8. Aplicarle a un panel fijo el descuento de la hoja
    // movil lo dejaria 101 mm mas corto de lo que debe -- y eso se corta, se suelda y se paga.
    const esFijo = !isSlidingLeaf(tree);
    const dwSpec = esFijo ? sizing.fixedWidthDeductionMm : sizing.perLeafWidthDeductionMm;
    const dhSpec = esFijo ? sizing.fixedHeightDeductionMm : sizing.perLeafHeightDeductionMm;
    // La hoja se centra en su hueco nominal: el marco se reparte a partes iguales a cada lado, que
    // es como lo expresa la ficha (un solo descuento por eje, no uno por cara).
    const dw = Math.min(dwSpec, width), dh = Math.min(dhSpec, height);
    const fabW = width - dw, fabH = height - dh;
    return [{
      id: tree.id, wing: tree.wing, spec: tree.spec, x, y, w: width, h: height, edges,
      fabX: x + dw / 2, fabY: y + dh / 2, fabW, fabH,
    }];
  }
  if (tree.kind === "leaf") {
    const sliding = isSlidingLeaf(tree);
    const leftD = !sliding ? 0 : edges.left === true ? seatMm : edges.left === "overlap" ? -overlapMm / 2 : 0;
    const rightD = !sliding ? 0 : edges.right === true ? -seatMm : edges.right === "overlap" ? overlapMm / 2 : 0;
    const topD = !sliding ? 0 : edges.top === true ? seatMm : edges.top === "overlap" ? -overlapMm / 2 : 0;
    const bottomD = !sliding ? 0 : edges.bottom === true ? -seatMm : edges.bottom === "overlap" ? overlapMm / 2 : 0;
    const fabX = x + leftD, fabRight = x + width + rightD;
    const fabY = y + topD, fabBottom = y + height + bottomD;
    return [{ id: tree.id, wing: tree.wing, spec: tree.spec, x, y, w: width, h: height, edges, fabX, fabY, fabW: fabRight - fabX, fabH: fabBottom - fabY }];
  }
  const n = tree.children.length;
  const frames: LeafFrame[] = [];
  let offset = 0;
  tree.children.forEach((child, i) => {
    // Same "sliding leaves meeting mid-run share an 'overlap' edge, not a structural
    // travesaño" rule as FrameNodeView's rendering (this is now its single source of truth).
    const slideNeighbor = (j: number) => j >= 0 && j < n && isSlidingLeaf(child) && isSlidingLeaf(tree.children[j]);
    const childEdges: Edges =
      tree.axis === "col"
        ? {
            top: edges.top,
            bottom: edges.bottom,
            left: i === 0 ? edges.left : slideNeighbor(i - 1) ? "overlap" : false,
            right: i === n - 1 ? edges.right : slideNeighbor(i + 1) ? "overlap" : false,
          }
        : {
            top: i === 0 ? edges.top : slideNeighbor(i - 1) ? "overlap" : false,
            bottom: i === n - 1 ? edges.bottom : slideNeighbor(i + 1) ? "overlap" : false,
            left: edges.left,
            right: edges.right,
          };
    const ratio = tree.ratios[i];
    if (tree.axis === "col") {
      const w = width * ratio;
      frames.push(...flattenToLeafFrames(child, w, height, sys, childEdges, x + offset, y));
      offset += w;
    } else {
      const h = height * ratio;
      frames.push(...flattenToLeafFrames(child, width, h, sys, childEdges, x, y + offset));
      offset += h;
    }
  });
  return frames;
}

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

// The marco and each leaf carry a per-side "reinforcement" flag (see defaultSides()) that used
// to be pure UI with no effect anywhere -- this turns those flags into real cut pieces, one per
// flagged side, all sharing the single reinforcement profile code set on the marco (there's no
// separate per-leaf reinforcement code field; a window uses one reinforcement profile throughout).
// Reinforcement inserts are straight-cut (90°), never mitered, regardless of the frame/sash miter.
// Ported from static/cotizador.html's buildReinforcementCutList.
export function buildReinforcementCutList(
  tree: FrameNode,
  width: number,
  height: number,
  marco: Marco
): { label: string; length: number; angle: string }[] {
  const pieces: { label: string; length: number; angle: string }[] = [];
  const SIDE_LEN_MARCO: Record<keyof Sides, number> = { top: width, bottom: width, left: height, right: height };
  (["top", "bottom", "left", "right"] as const).forEach((s) => {
    if (marco.sides[s].reinforcement) pieces.push({ label: `Marco: ${SIDE_LABEL[s]}`, length: Math.round(SIDE_LEN_MARCO[s]), angle: "90°" });
  });
  flattenToRects(tree, width, height).forEach((r, i) => {
    const label = `Hoja ${String.fromCharCode(65 + i)}`;
    const lens: Record<keyof Sides, number> = { top: r.w, bottom: r.w, left: r.h, right: r.h };
    (["top", "bottom", "left", "right"] as const).forEach((s) => {
      if (r.spec.sides[s]?.reinforcement) pieces.push({ label: `${label}: ${SIDE_LABEL[s]}`, length: Math.round(lens[s]), angle: "90°" });
    });
  });
  return pieces;
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
