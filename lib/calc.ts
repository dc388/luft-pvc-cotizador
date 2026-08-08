import type { ColorItem, FrameNode, GlassItem, Marco, PaneSpec, System, WingType } from "@/types/domain";
import { buildReinforcementCutList, flattenToLeafFrames } from "./tree";
import { profileFamilies } from "@/data/families";
import { EUR_MXN } from "@/data/catalog";

// Representative rate for the Mallorquina louvre-shutter accessory (avg. of the 5
// Mallorquina families' base EUR/m prices * EUR_MXN) — modeled as a per-leaf add-on, not a
// wing type, since it's an exterior shading accessory mounted over a window, not one of the
// window's own opening mechanisms. See data/catalog.ts for EUR_MXN.
const MALLORQUINA_RATE_MXN_PER_M = 47;

// Below this, the canvas renders an unusable sliver with no warning that the design is
// unfabricable — ported from static/cotizador.html's MIN_OPENING_MM.
export const MIN_OPENING_MM = 300;

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
  marco: Marco;
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

// Looks up a reinforcement (steel/aluminum insert) profile by its real catalog code, restricted
// to entries actually named "refuerzo ..." so a marco/hoja/junquillo code typo'd into this field
// can't accidentally resolve to an unrelated part.
function reinforcementProfile(code: string) {
  if (!code) return null;
  return profileFamilies.find((f) => f.code === code && /^refuerzo/i.test(f.name)) ?? null;
}

export function calcQuote({ width, height, qty, tree, sys, glass, color, rail, installation, transport, margin, discount, marco }: Params): QuoteCalc {
  const w = width / 1000, h = height / 1000;
  const area = w * h, perimeter = 2 * (w + h);

  // Real fabrication size per leaf: for sliding leaves this differs from a plain marco/n
  // split -- each hoja seats sys.frameSeatMm into the outer marco on the sides that touch
  // it, and extends sys.centerOverlapMm/2 past the nominal centerline on the side where it
  // traslapes a sliding sibling, so the two closed leaves actually overlap instead of just
  // butting edge to edge. See flattenToLeafFrames.
  const frames = flattenToLeafFrames(tree, width, height, sys.frameSeatMm, sys.centerOverlapMm);
  const leaves: LeafCalc[] = frames.map((r) => {
    const wM = r.fabW / 1000, hM = r.fabH / 1000;
    // Fixed/inactive leaves glaze straight into the marco/travesaño -- no sash profile to
    // cut, matching buildCutList's own condition below. Charging sash length here for a
    // leaf the cut list never produces pieces for double-counted profile cost.
    const hasSash = r.wing !== "fixed" && r.wing !== "inactive";
    return {
      id: r.id,
      wing: r.wing,
      spec: r.spec,
      wMm: r.fabW,
      hMm: r.fabH,
      glassArea: Math.max(0, (wM - 0.12) * (hM - 0.12)),
      sashPerimeter: hasSash ? 2 * (wM + hM) : 0,
    };
  });

  const frameM = perimeter + splitterLengthM(tree, width, height);
  const sashM = leaves.reduce((a, l) => a + l.sashPerimeter, 0);
  const glassArea = leaves.reduce((a, l) => a + l.glassArea, 0);

  const profileCost = (frameM * sys.frame + sashM * sys.sash) * color.factor;
  const glassCost = glassArea * glass.price;
  // Reinforcement used to be a flat (frameM+sashM)*78 guess regardless of whether the marco/hoja
  // side editors' "reinforcement" checkboxes were even on. Now: if the marco's global toggle is
  // on, a code is set, and it resolves to a real catalog profile, cost the exact flagged sides at
  // that profile's real €/m (converted at EUR_MXN) -- otherwise fall back to the old flat guess,
  // so a quote that has never touched the reinforcement editor doesn't silently lose this cost.
  const reinforcementPieces = buildReinforcementCutList(tree, width, height, marco);
  const reinforcementMatch = marco.reinforcement ? reinforcementProfile(marco.reinforcementCode) : null;
  const reinforce = reinforcementMatch && reinforcementPieces.length
    ? (reinforcementPieces.reduce((a, pc) => a + pc.length, 0) / 1000) * reinforcementMatch.priceEUR * EUR_MXN
    : (frameM + sashM) * 78;
  const seals = (frameM + sashM) * 24;
  const accessories = sys.hardware + leaves.length * 110 + rail * 165;
  const addons = leaves.reduce((a, l) => a + (l.spec.mallorquina ? (l.wMm / 1000) * MALLORQUINA_RATE_MXN_PER_M * 2 : 0), 0);
  const consumables = (profileCost + glassCost) * 0.045;
  const direct = profileCost + glassCost + reinforce + seals + accessories + addons + consumables + installation + transport;
  const sale = (direct / (1 - margin / 100)) * (1 - discount / 100);

  // Real per-category bin-packing against the actual commercial bar length/kerf, instead of a
  // flat (frameM+sashM)/6m estimate that ignored kerf and ignored qty>1's opportunity to share
  // bars across units -- this now matches exactly what CorteDoc's cut-optimization report shows.
  const cutForBars = buildCutList(tree, width, height, sys);
  const packedCategories = [cutForBars.marco, cutForBars.travesanos, cutForBars.hojas, cutForBars.junquillos, reinforcementPieces].map((pieces) => {
    const qtyPieces: CutPiece[] = [];
    for (let i = 0; i < qty; i++) qtyPieces.push(...pieces);
    return packBars(qtyPieces, BAR_LENGTH_MM, KERF_MM);
  });
  const bars = packedCategories.reduce((a, bs) => a + bs.length, 0);
  const waste = packedCategories.reduce((a, bs) => a + bs.reduce((x, b) => x + b.waste, 0), 0) / 1000;

  return {
    w, h, area, perimeter, leaves, frameM, sashM, glassArea,
    profileCost, glassCost, reinforce, seals, accessories, addons, consumables,
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
export function buildCutList(tree: FrameNode, width: number, height: number, sys: System): CutList {
  const marco: CutPiece[] = [
    { label: "Marco: Abajo", length: width, angle: "45°" },
    { label: "Marco: Arriba", length: width, angle: "45°" },
    { label: "Marco: Izquierda", length: height, angle: "45°" },
    { label: "Marco: Derecha", length: height, angle: "45°" },
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
  // Real hoja/junquillo cut length: fabW/fabH already fold in each sliding leaf's marco-seat
  // inset and center-traslape extension (flattenToLeafFrames), so two correderas meeting
  // mid-run are cut to actually overlap there instead of butting edge to edge at width/2.
  flattenToLeafFrames(tree, width, height, sys.frameSeatMm, sys.centerOverlapMm).forEach((r, i) => {
    const label = `Hoja ${String.fromCharCode(65 + i)}`;
    const w = Math.round(r.fabW), h = Math.round(r.fabH);
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
