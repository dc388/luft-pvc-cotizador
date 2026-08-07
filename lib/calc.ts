import type { ColorItem, FrameNode, GlassItem, PaneSpec, System, WingType } from "@/types/domain";
import { flattenToRects, hasSashWing, isOperableWing } from "./tree";

// Representative rate for the Mallorquina louvre-shutter accessory (avg. of the 5
// Mallorquina families' base EUR/m prices * EUR_MXN) — modeled as a per-leaf add-on, not a
// wing type, since it's an exterior shading accessory mounted over a window, not one of the
// window's own opening mechanisms. See data/catalog.ts for EUR_MXN.
const MALLORQUINA_RATE_MXN_PER_M = 47;

export type LeafCalc = {
  id: string;
  wing: WingType;
  spec: PaneSpec;
  wMm: number;
  hMm: number;
  glassArea: number;
  sashPerimeter: number;
};

export type QuoteCalc = {
  w: number;
  h: number;
  area: number;
  perimeter: number;
  leaves: LeafCalc[];
  frameM: number;
  sashM: number;
  glassArea: number;
  profileCost: number;
  glassCost: number;
  reinforce: number;
  seals: number;
  accessories: number;
  hardwareCount: number;
  addons: number;
  consumables: number;
  direct: number;
  sale: number;
  total: number;
  utility: number;
  bars: number;
  waste: number;
};

type Params = {
  width: number;
  height: number;
  qty: number;
  tree: FrameNode;
  sys: System;
  glass: GlassItem;
  color: ColorItem;
  rail: number;
  installation: number;
  transport: number;
  margin: number;
  discount: number;
};

// Meters of internal splitter/mullion profile contributed by every SplitNode:
// (children.length - 1) dividers, each spanning the cross-axis length of that
// split's box, recursed into every child's own sub-splits.
function splitterLengthM(node: FrameNode, widthMm: number, heightMm: number): number {
  if (node.kind === "leaf") return 0;
  const dividerLenM = (node.axis === "col" ? heightMm : widthMm) / 1000;
  let total = (node.children.length - 1) * dividerLenM;
  node.children.forEach((child, i) => {
    const ratio = node.ratios[i];
    const w = node.axis === "col" ? widthMm * ratio : widthMm;
    const h = node.axis === "row" ? heightMm * ratio : heightMm;
    total += splitterLengthM(child, w, h);
  });
  return total;
}

export function calcQuote({ width, height, qty, tree, sys, glass, color, rail, installation, transport, margin, discount }: Params): QuoteCalc {
  const w = width / 1000, h = height / 1000;
  const area = w * h, perimeter = 2 * (w + h);

  const rects = flattenToRects(tree, width, height);
  const leaves: LeafCalc[] = rects.map((r) => {
    const wM = r.w / 1000, hM = r.h / 1000;
    return {
      id: r.id,
      wing: r.wing,
      spec: r.spec,
      wMm: r.w,
      hMm: r.h,
      glassArea: Math.max(0, (wM - 0.12) * (hM - 0.12)),
      sashPerimeter: hasSashWing(r.wing) ? 2 * (wM + hM) : 0,
    };
  });

  const frameM = perimeter + splitterLengthM(tree, width, height);
  const sashM = leaves.reduce((a, l) => a + l.sashPerimeter, 0);
  const glassArea = leaves.reduce((a, l) => a + l.glassArea, 0);
  const hardwareCount = leaves.filter((l) => isOperableWing(l.wing)).length;

  const profileCost = (frameM * sys.frame + sashM * sys.sash) * color.factor;
  const glassCost = glassArea * glass.price;
  const reinforce = (frameM + sashM) * 78;
  const seals = (frameM + sashM) * 24;
  const accessories = sys.hardware + hardwareCount * 110 + rail * 165;
  const addons = leaves.reduce((a, l) => a + (l.spec.mallorquina ? (l.wMm / 1000) * MALLORQUINA_RATE_MXN_PER_M * 2 : 0), 0);
  const consumables = (profileCost + glassCost) * 0.045;
  const direct = profileCost + glassCost + reinforce + seals + accessories + addons + consumables + installation + transport;
  const sale = (direct / (1 - margin / 100)) * (1 - discount / 100);
  const bars = Math.ceil((frameM + sashM) / 6);
  const waste = Math.max(0, bars * 6 - frameM - sashM);

  return {
    w, h, area, perimeter, leaves, frameM, sashM, glassArea,
    profileCost, glassCost, reinforce, seals, accessories, hardwareCount, addons, consumables,
    direct, sale, total: sale * qty, utility: (sale - direct) * qty, bars, waste,
  };
}

// ---------- CUT-LIST OPTIMIZER (real 1D bin packing, first-fit-decreasing) ----------
export const BAR_LENGTH_MM = 5800;
export const KERF_MM = 5;

export type CutPiece = { label: string; length: number; angle: string };
export type PackedBar = { pieces: CutPiece[]; used: number; waste: number };
export type CutList = { marco: CutPiece[]; travesanos: CutPiece[]; hojas: CutPiece[]; junquillos: CutPiece[] };

export function packBars(pieces: CutPiece[], barLength: number, kerf: number): PackedBar[] {
  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  const bars: { pieces: CutPiece[] }[] = [];
  for (const piece of sorted) {
    let placed = false;
    for (const bar of bars) {
      const used = bar.pieces.reduce((a, p) => a + p.length, 0) + bar.pieces.length * kerf;
      if (used + piece.length <= barLength) {
        bar.pieces.push(piece);
        placed = true;
        break;
      }
    }
    if (!placed) bars.push({ pieces: [piece] });
  }
  return bars.map((bar) => {
    const used = bar.pieces.reduce((a, p) => a + p.length, 0) + Math.max(0, bar.pieces.length - 1) * kerf;
    return { pieces: bar.pieces, used, waste: barLength - used };
  });
}

// Derives real cut pieces from the tree: 4 outer marco pieces regardless of splits, one
// travesaño per internal divider (its own actual cross-axis length), 4 hoja pieces per
// non-fixed/inactive leaf (fixed/inactive leaves glaze straight into marco/travesaño, no
// sash), and 4 junquillo (glazing bead) pieces per leaf.
export function buildCutList(tree: FrameNode, width: number, height: number): CutList {
  const marco: CutPiece[] = [
    { label: "Marco: Abajo", length: Math.round(width), angle: "45°" },
    { label: "Marco: Arriba", length: Math.round(width), angle: "45°" },
    { label: "Marco: Izquierda", length: Math.round(height), angle: "45°" },
    { label: "Marco: Derecha", length: Math.round(height), angle: "45°" },
  ];
  const travesanos: CutPiece[] = [];
  (function walk(node: FrameNode, w: number, h: number) {
    if (node.kind === "leaf") return;
    const crossLen = Math.round(node.axis === "col" ? h : w);
    for (let i = 0; i < node.children.length - 1; i++) travesanos.push({ label: "Travesaño", length: crossLen, angle: "90°" });
    node.children.forEach((child, i) => {
      const cw = node.axis === "col" ? w * node.ratios[i] : w;
      const ch = node.axis === "row" ? h * node.ratios[i] : h;
      walk(child, cw, ch);
    });
  })(tree, width, height);
  const hojas: CutPiece[] = [];
  const junquillos: CutPiece[] = [];
  flattenToRects(tree, width, height).forEach((r, i) => {
    const label = `Hoja ${String.fromCharCode(65 + i)}`;
    const w = Math.round(r.w), h = Math.round(r.h);
    if (r.wing !== "fixed" && r.wing !== "inactive") {
      hojas.push(
        { label: `${label}: Arriba`, length: w, angle: "45°" },
        { label: `${label}: Abajo`, length: w, angle: "45°" },
        { label: `${label}: Izquierda`, length: h, angle: "45°" },
        { label: `${label}: Derecha`, length: h, angle: "45°" }
      );
    }
    junquillos.push(
      { label: `${label}: Arriba`, length: w, angle: "90°" },
      { label: `${label}: Abajo`, length: w, angle: "90°" },
      { label: `${label}: Izquierda`, length: h, angle: "90°" },
      { label: `${label}: Derecha`, length: h, angle: "90°" }
    );
  });
  return { marco, travesanos, hojas, junquillos };
}
