import type { ColorItem, GlassItem, Marco, FrameNode, System } from "@/types/domain";
import { walkLeaves } from "./tree";
import { calcQuote } from "./calc";
import { profileFamilies } from "@/data/families";

export type SelfCheckItem = { name: string; pass: boolean };
export type SelfCheckResult = { ok: boolean; checks: SelfCheckItem[]; ranAt: string };

type Params = {
  tree: FrameNode;
  width: number;
  height: number;
  qty: number;
  sys: System;
  glass: GlassItem;
  color: ColorItem;
  rail: number;
  installation: number;
  transport: number;
  margin: number;
  discount: number;
  marco: Marco;
  /** true once the 3D viewer has successfully mounted its WebGL renderer at least once. */
  threeReady: boolean;
};

// Direct port of runSelfCheck from static/cotizador.html — a lightweight running health
// check surfaced as a badge in the TopBar, re-run periodically.
export function runSelfCheck(p: Params): SelfCheckResult {
  const checks: SelfCheckItem[] = [];
  const ids = walkLeaves(p.tree).map((l) => l.id);
  checks.push({ name: "IDs de hoja únicos", pass: new Set(ids).size === ids.length && ids.length > 0 });

  function ratiosOk(node: FrameNode): boolean {
    if (node.kind === "leaf") return true;
    const sum = node.ratios.reduce((a, b) => a + b, 0);
    return Math.abs(sum - 1) < 0.01 && node.children.every(ratiosOk);
  }
  checks.push({ name: "Proporciones de división suman 1", pass: ratiosOk(p.tree) });

  let calcOk = false;
  try {
    const c = calcQuote({
      width: p.width, height: p.height, qty: p.qty, tree: p.tree, sys: p.sys, glass: p.glass, color: p.color,
      rail: p.rail, installation: p.installation, transport: p.transport, margin: p.margin, discount: p.discount,
    });
    calcOk = Number.isFinite(c.total) && c.total >= 0 && Number.isFinite(c.area) && c.leaves.length === ids.length;
  } catch {
    calcOk = false;
  }
  checks.push({ name: "Motor de cálculo consistente", pass: calcOk });
  checks.push({ name: "Catálogo de perfiles cargado", pass: profileFamilies.length > 200 });
  checks.push({ name: "Motor 3D cargado", pass: p.threeReady });
  const marcoOk = !!p.marco && !!p.marco.sides && (["top", "bottom", "left", "right"] as const).every((s) => !!p.marco.sides[s]);
  checks.push({ name: "Marco de conjunto íntegro", pass: marcoOk });

  return { ok: checks.every((c) => c.pass), checks, ranAt: new Date().toString() };
}
