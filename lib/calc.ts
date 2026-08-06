import type { ColorItem, FrameNode, GlassItem, PaneSpec, System, WingType } from "@/types/domain";
import { flattenToRects } from "./tree";

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
      sashPerimeter: 2 * (wM + hM),
    };
  });

  const frameM = perimeter + splitterLengthM(tree, width, height);
  const sashM = leaves.reduce((a, l) => a + l.sashPerimeter, 0);
  const glassArea = leaves.reduce((a, l) => a + l.glassArea, 0);

  const profileCost = (frameM * sys.frame + sashM * sys.sash) * color.factor;
  const glassCost = glassArea * glass.price;
  const reinforce = (frameM + sashM) * 78;
  const seals = (frameM + sashM) * 24;
  const accessories = sys.hardware + leaves.length * 110 + rail * 165;
  const addons = leaves.reduce((a, l) => a + (l.spec.mallorquina ? (l.wMm / 1000) * MALLORQUINA_RATE_MXN_PER_M * 2 : 0), 0);
  const consumables = (profileCost + glassCost) * 0.045;
  const direct = profileCost + glassCost + reinforce + seals + accessories + addons + consumables + installation + transport;
  const sale = (direct / (1 - margin / 100)) * (1 - discount / 100);
  const bars = Math.ceil((frameM + sashM) / 6);
  const waste = Math.max(0, bars * 6 - frameM - sashM);

  return {
    w, h, area, perimeter, leaves, frameM, sashM, glassArea,
    profileCost, glassCost, reinforce, seals, accessories, addons, consumables,
    direct, sale, total: sale * qty, utility: (sale - direct) * qty, bars, waste,
  };
}
