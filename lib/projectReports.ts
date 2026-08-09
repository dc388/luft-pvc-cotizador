import { catalog } from "@/data/catalog";
import { colors } from "@/data/colors";
import { glassCatalog } from "@/data/glass";
import { buildCutList, calcQuote, type CutPiece, type QuoteCalc } from "@/lib/calc";
import type { ComponentRecord } from "@/types/project";

function sysFor(c: ComponentRecord) {
  return catalog[c.brand][Math.min(c.systemIndex, catalog[c.brand].length - 1)];
}
function colorFor(c: ComponentRecord) {
  return colors[c.brand][Math.min(c.colorIndex, colors[c.brand].length - 1)];
}
function glassFor(c: ComponentRecord) {
  return glassCatalog[c.data.glassIndex];
}

export function calcForComponent(c: ComponentRecord): QuoteCalc {
  return calcQuote({
    width: c.widthMm,
    height: c.heightMm,
    qty: c.qty,
    tree: c.data.tree,
    sys: sysFor(c),
    glass: glassFor(c),
    color: colorFor(c),
    rail: c.data.rail,
    installation: c.data.installation,
    transport: c.data.transport,
    margin: c.data.margin,
    discount: c.data.discount,
    marco: c.data.marco,
    barLengthMm: c.data.barLengthMm,
  });
}

export type ProjectCutGroup = {
  brand: ComponentRecord["brand"];
  systemIndex: number;
  colorIndex: number;
  components: ComponentRecord[];
  marco: CutPiece[];
  travesanos: CutPiece[];
  hojas: CutPiece[];
  junquillos: CutPiece[];
};

// Cross-component cutting optimization: a real factory nests cut pieces from EVERY component
// in the project that shares a profile (brand+system+color) into one packBars run, instead of
// optimizing each component's bars in isolation. Two components in different colors can never
// share a bar in reality, so they're never grouped together here. Ported from
// buildProjectCutList in static/cotizador.html (commit 88f18e8).
export function buildProjectCutList(componentsList: ComponentRecord[]): ProjectCutGroup[] {
  const groups = new Map<string, ProjectCutGroup>();
  componentsList.forEach((c) => {
    const key = `${c.brand}|${c.systemIndex}|${c.colorIndex}`;
    let g = groups.get(key);
    if (!g) {
      g = { brand: c.brand, systemIndex: c.systemIndex, colorIndex: c.colorIndex, components: [], marco: [], travesanos: [], hojas: [], junquillos: [] };
      groups.set(key, g);
    }
    g.components.push(c);
    const cut = buildCutList(c.data.tree, c.widthMm, c.heightMm, sysFor(c));
    const tag = (p: CutPiece): CutPiece => ({ ...p, label: `${p.label} (${c.designation})` });
    for (let i = 0; i < c.qty; i++) {
      g.marco.push(...cut.marco.map(tag));
      g.travesanos.push(...cut.travesanos.map(tag));
      g.hojas.push(...cut.hojas.map(tag));
      g.junquillos.push(...cut.junquillos.map(tag));
    }
  });
  return Array.from(groups.values());
}

export { sysFor, colorFor, glassFor };
