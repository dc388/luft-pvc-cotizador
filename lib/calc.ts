import type { ColorItem, FrameNode, GlassItem, PaneSpec, System, WingType } from "@/types/domain";
import { EUR_MXN, IMPORT_FACTOR } from "@/data/catalog";
import { flattenToRects } from "./tree";

// ---------- STOCK BAR GEOMETRY ----------
// Single source of truth for bar length: the cut-list optimizer and the cost engine must
// agree, otherwise the quote is costed against a different bar than the one the shop cuts.
export const BAR_LENGTH_MM = 5800;
export const BAR_LENGTH_M = BAR_LENGTH_MM / 1000;
export const KERF_MM = 5;

// ---------- MALLORQUINA (exterior louvre shutter) ----------
// Modeled as a per-leaf add-on, not a wing type: it's an exterior shading accessory mounted
// over a window, not one of the window's own opening mechanisms.
//
// Costed from the real MALLORQUINA families in data/families.ts. A louvre shutter is a stack
// of fixed lamas inside a tapajuntas frame, so its profile consumption scales with leaf
// HEIGHT (how many lamas fit) as well as width — a flat per-metre-of-width rate undercounts
// it by roughly an order of magnitude.
const MALLORQUINA_LAMA_EUR_PER_M = 1.69; // 190235 "lama fija 45mm p/mallorq"
const MALLORQUINA_TRIM_EUR_PER_M = 2.29; // 190227/190228 "tapajuntas troquel. p/lama fija"
// 45 mm lama installed with ~5 mm overlap between courses.
const MALLORQUINA_LAMA_PITCH_MM = 40;
// CALIBRAR: hinges, stays and fixings for the shutter are not in the profile price list and
// are therefore NOT included below. Set a real per-shutter figure once known.
const MALLORQUINA_HARDWARE_MXN = 0;

// Profile metres consumed by one Mallorquina over a leaf of wM x hM, priced in MXN.
function mallorquinaCost(wM: number, hM: number): number {
  const lamaCount = Math.ceil((hM * 1000) / MALLORQUINA_LAMA_PITCH_MM);
  const lamaM = lamaCount * wM;
  const trimM = 2 * (wM + hM);
  const profileEUR = lamaM * MALLORQUINA_LAMA_EUR_PER_M + trimM * MALLORQUINA_TRIM_EUR_PER_M;
  return profileEUR * EUR_MXN * IMPORT_FACTOR + MALLORQUINA_HARDWARE_MXN;
}

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
  /** Portion of profileCost that is offcut/waste rather than profile in the finished window. */
  profileWasteCost: number;
  glassCost: number;
  reinforce: number;
  seals: number;
  accessories: number;
  addons: number;
  consumables: number;
  /** Shop labour: cutting, welding, cleaning, hardware fitting and glazing. */
  labor: number;
  direct: number;
  sale: number;
  total: number;
  /** Gross contribution (sale - direct). Does NOT carry fixed overhead. */
  utility: number;
  /** Fixed overhead absorbed by this quote, at overheadPct of sale. */
  overhead: number;
  /** Utility left after overhead — the number that actually reaches the bottom line. */
  netUtility: number;
  /** Net utility as a percentage of sale. */
  netMarginPct: number;
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
  /** Offcut allowance on profile, as a % of net linear metres. Defaults to DEFAULT_WASTE_PCT. */
  wastePct?: number;
  /** Shop labour rate in MXN per m² of window. Defaults to DEFAULT_LABOR_MXN_PER_M2. */
  laborPerM2?: number;
  /** Fixed overhead as a % of sale, used only to report net utility. Defaults to DEFAULT_OVERHEAD_PCT. */
  overheadPct?: number;
};

// Offcut allowance. Costing profile on exact net metres assumes zero waste, but stock comes
// in fixed 5.8 m bars and the remnants are usually unusable — the shop buys more metres than
// the window contains. A percentage (rather than per-window bar rounding) is the right model
// because optimisation spreads offcuts across a production batch.
// CALIBRAR against real consumption: (metres bought) / (metres in finished windows) - 1.
export const DEFAULT_WASTE_PCT = 12;

// Shop labour: cutting, welding, corner cleaning, reinforcement, hardware fitting and
// glazing. This is fabrication work in the plant and is distinct from `installation`
// (on-site fitting) and `transport` (freight), which are quoted separately per piece.
//
// Derived from the shop's own figures (Ago 2026): 2 operarios a $1,000/día pagados en mano;
// con ~40% de carga social (IMSS, INFONAVIT, aguinaldo, vacaciones, prima) el costo real es
// $1,400/día. Producción normal 3-4 ventanas/día ≈ 6.3 m²/día con ventana promedio de 1.8 m².
//   $1,400 / 6.3 m² ≈ $222/m²  ->  se redondea a 225.
// CALIBRAR: recalcular si cambia la plantilla, el salario o el ritmo de producción. Si el
// taller no factura todos los días pagados, la tarifa efectiva sube en la misma proporción.
export const DEFAULT_LABOR_MXN_PER_M2 = 225;

// Rent, admin payroll, utilities, software, vehicles — everything that is not traceable to a
// single window. Used only to report net utility; it does not change the quoted price.
// CALIBRAR: (monthly fixed costs) / (monthly sales).
export const DEFAULT_OVERHEAD_PCT = 20;

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

export function calcQuote({
  width, height, qty, tree, sys, glass, color, rail, installation, transport, margin, discount,
  wastePct = DEFAULT_WASTE_PCT,
  laborPerM2 = DEFAULT_LABOR_MXN_PER_M2,
  overheadPct = DEFAULT_OVERHEAD_PCT,
}: Params): QuoteCalc {
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
      sashPerimeter: 2 * (wM + hM),
    };
  });

  const frameM = perimeter + splitterLengthM(tree, width, height);
  const sashM = leaves.reduce((a, l) => a + l.sashPerimeter, 0);
  const glassArea = leaves.reduce((a, l) => a + l.glassArea, 0);

  // Net profile in the finished window, then the metres actually bought to produce it.
  const profileNet = (frameM * sys.frame + sashM * sys.sash) * color.factor * IMPORT_FACTOR;
  const profileCost = profileNet * (1 + wastePct / 100);
  const profileWasteCost = profileCost - profileNet;
  const glassCost = glassArea * glass.price;
  const reinforce = (frameM + sashM) * 78;
  const seals = (frameM + sashM) * 24;
  const accessories = sys.hardware + leaves.length * 110 + rail * 165;
  const addons = leaves.reduce((a, l) => a + (l.spec.mallorquina ? mallorquinaCost(l.wMm / 1000, l.hMm / 1000) : 0), 0);
  const consumables = (profileCost + glassCost) * 0.045;
  const labor = area * laborPerM2;
  const direct = profileCost + glassCost + reinforce + seals + accessories + addons + consumables + labor + installation + transport;
  const sale = (direct / (1 - margin / 100)) * (1 - discount / 100);
  const overhead = sale * (overheadPct / 100);
  const bars = Math.ceil((frameM + sashM) / BAR_LENGTH_M);
  const waste = Math.max(0, bars * BAR_LENGTH_M - frameM - sashM);

  return {
    w, h, area, perimeter, leaves, frameM, sashM, glassArea,
    profileCost, profileWasteCost, glassCost, reinforce, seals, accessories, addons, consumables, labor,
    direct, sale, total: sale * qty, utility: (sale - direct) * qty,
    overhead: overhead * qty,
    netUtility: (sale - direct - overhead) * qty,
    netMarginPct: sale > 0 ? ((sale - direct - overhead) / sale) * 100 : 0,
    bars, waste,
  };
}

// ---------- CUT-LIST OPTIMIZER (real 1D bin packing, first-fit-decreasing) ----------
// BAR_LENGTH_MM / KERF_MM are declared at the top of this file so the cost engine and this
// optimizer cannot drift apart.

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
