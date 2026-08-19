import type { ColorItem, FrameNode, GlassItem, Marco, PaneSpec, System, WingType } from "@/types/domain";
import { buildReinforcementCutList, flattenToLeafFrames, type LeafFrame } from "./tree";
import { profileFamilies } from "@/data/families";
import { glassCatalog } from "@/data/glass";
import { EUR_MXN, IMPORT_FACTOR } from "@/data/catalog";
import { resolveHardwareCost, type VerifiedHardwareCosting } from "./maco/costing";
import { beadFor, glassSizeMm, WELD_ALLOWANCE_MM } from "@/data/glazing";

// ---------- MALLORQUINA (exterior louvre shutter) ----------
// Modeled as a per-leaf add-on, not a wing type: it's an exterior shading accessory mounted
// over a window, not one of the window's own opening mechanisms.
//
// Costed from the real MALLORQUINA families in data/families.ts. A louvre shutter is a stack
// of fixed lamas inside a tapajuntas frame, so its profile consumption scales with leaf
// HEIGHT (how many lamas fit) as well as width — the flat per-metre-of-width rate this
// replaced undercounted it by roughly an order of magnitude.
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

// ---------- TARIFAS DE COSTEO (editables desde la pestaña Servicios) ----------

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
  /** Medida con la que se COMPRA el vidrio de esta hoja, en mm. Sale de data/glazing.ts según el
   *  sistema y según si la hoja acristala contra el marco (fija/inactiva) o contra la hoja. Antes
   *  cada reporte la recalculaba restando 120 mm por su cuenta, en tres archivos distintos. */
  glassWMm: number;
  glassHMm: number;
  /** `false` cuando el descuento del sistema todavía no está calibrado y se está usando el valor
   *  heredado. Los reportes lo advierten en lugar de callarlo. */
  glassCalibrated: boolean;
  /** The glass actually costed for this leaf -- spec.glass's own catalog entry when the leaf
   * overrides the window's general glass, otherwise the general glass itself. */
  glassUsed: GlassItem;
};

// A leaf's `spec.glass` can name a different catalog glass than the window's general
// selection ("Heredar vidrio general" = no override). Resolves to the real GlassItem so both
// the cost engine and reports price/report each leaf's ACTUAL glass, not always the general one.
export function resolveLeafGlass(spec: PaneSpec, generalGlass: GlassItem): GlassItem {
  if (spec.glass === "Heredar vidrio general") return generalGlass;
  return glassCatalog.find((g) => g.name === spec.glass) ?? generalGlass;
}

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
  hardwareLeafCount: number;
  /** `true` solo cuando `accessories` salió de una lista de materiales verificada con precios
   * reales de proveedor. `false` significa que es la estimación de siempre. Ver lib/maco/costing.ts. */
  hardwareVerified: boolean;
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
  marco: Marco;
  /** Offcut allowance on profile, as a % of net linear metres. Defaults to DEFAULT_WASTE_PCT. */
  wastePct?: number;
  /** Shop labour rate in MXN per m² of window. Defaults to DEFAULT_LABOR_MXN_PER_M2. */
  laborPerM2?: number;
  /** Fixed overhead as a % of sale, used only to report net utility. Defaults to DEFAULT_OVERHEAD_PCT. */
  overheadPct?: number;
  /** Commercial stock bar length used for cut-list bin-packing (bars/waste below and the
   * despiece report) -- defaults to BAR_LENGTH_MM when not given. */
  barLengthMm?: number;
  /** Lista de materiales de herrajes con precios verificados de proveedor (MACO). OPCIONAL y sin
   * efecto salvo que traiga las seis condiciones que exige lib/maco/costing.ts. Omitirlo -- que es
   * lo que hace hoy todo el que llama a calcQuote -- deja el cálculo exactamente como estaba. */
  hardwareCosting?: VerifiedHardwareCosting;
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

export function calcQuote({
  width, height, qty, tree, sys, glass, color, rail, installation, transport, margin, discount, marco,
  barLengthMm, hardwareCosting,
  wastePct = DEFAULT_WASTE_PCT,
  laborPerM2 = DEFAULT_LABOR_MXN_PER_M2,
  overheadPct = DEFAULT_OVERHEAD_PCT,
}: Params): QuoteCalc {
  const w = width / 1000, h = height / 1000;
  const area = w * h, perimeter = 2 * (w + h);
  const barLength = barLengthMm ?? BAR_LENGTH_MM;

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
    // Una hoja sin perfil de hoja acristala directo en el marco, y el descuento de vidrio del marco
    // no es el de la hoja: son perfiles con caras distintas. `hasSash` es exactamente esa condición.
    const gl = glassSizeMm(r.fabW, r.fabH, sys.name, !hasSash);
    return {
      id: r.id,
      wing: r.wing,
      spec: r.spec,
      wMm: r.fabW,
      hMm: r.fabH,
      glassWMm: gl.wMm,
      glassHMm: gl.hMm,
      glassCalibrated: gl.calibrated,
      // El área se deriva de la medida real del vidrio, no de una resta propia: así el costeo y el
      // pedido de vidrio no pueden desacoplarse nunca.
      glassArea: (gl.wMm / 1000) * (gl.hMm / 1000),
      sashPerimeter: hasSash ? 2 * (wM + hM) : 0,
      glassUsed: resolveLeafGlass(r.spec, glass),
    };
  });

  const frameM = perimeter + splitterLengthM(tree, width, height);
  const sashM = leaves.reduce((a, l) => a + l.sashPerimeter, 0);
  const glassArea = leaves.reduce((a, l) => a + l.glassArea, 0);

  // Net profile in the finished window, then the metres actually bought to produce it: the
  // shop buys full 5.8 m bars and the offcuts are usually unusable, so costing on exact net
  // metres understated every profile line. IMPORT_FACTOR carries the EXWORK list up to landed
  // cost (see data/catalog.ts); it is 1.0 today, so this reproduces the old number until
  // someone calibrates it against a real pedimento.
  const profileNet = (frameM * sys.frame + sashM * sys.sash) * color.factor * IMPORT_FACTOR;
  const profileCost = profileNet * (1 + wastePct / 100);
  const profileWasteCost = profileCost - profileNet;
  // Per-leaf glass cost: a leaf that overrides the window's general glass (spec.glass) is
  // costed at ITS OWN catalog price, not the general glass's -- previously every leaf's area
  // was costed at the general glass's price even when VidrioDoc's report already showed the
  // override, so a leaf upgraded to a pricier glass was silently undercharged.
  const glassCost = leaves.reduce((a, l) => a + l.glassArea * l.glassUsed.price, 0);
  // Reinforcement used to be a flat (frameM+sashM)*78 guess regardless of whether the marco/hoja
  // side editors' "reinforcement" checkboxes were even on. Now: if the marco's global toggle is
  // on, a code is set, and it resolves to a real catalog profile, cost the exact flagged sides at
  // that profile's real €/m (converted at EUR_MXN) -- otherwise fall back to the old flat guess,
  // so a quote that has never touched the reinforcement editor doesn't silently lose this cost.
  const reinforcementPieces = buildReinforcementCutList(tree, width, height, marco);
  const reinforcementMatch = marco.reinforcement ? reinforcementProfile(marco.reinforcementCode) : null;
  // El refuerzo real sale de la misma lista EXWORK que los perfiles, así que lleva el mismo
  // IMPORT_FACTOR. La estimación plana de respaldo ya está en MXN y no lo lleva.
  const reinforce = reinforcementMatch && reinforcementPieces.length
    ? (reinforcementPieces.reduce((a, pc) => a + pc.length, 0) / 1000) * reinforcementMatch.priceEUR * EUR_MXN * IMPORT_FACTOR
    : (frameM + sashM) * 78;
  const seals = (frameM + sashM) * 24;
  // The per-leaf $110 "juego de herraje" fee only applies to leaves that actually carry
  // hardware (spec.hardware !== "Sin herraje") -- previously every leaf was charged this flat
  // fee regardless, so fixed/inactive panes (which defaultSpecFor always sets to "Sin
  // herraje") were incorrectly billed for hardware they don't have. This does NOT differentiate
  // by hardware TYPE (carros 80kg vs 120kg, etc.) -- there is no sourced per-type price list
  // yet, and Fase 5's rule is to never invent one; that stays a flat fee until real supplier
  // pricing exists.
  const hardwareLeafCount = leaves.filter((l) => l.spec.hardware !== "Sin herraje").length;
  // Costos verificados de proveedor SOLO si vienen con lista de materiales, cantidades probadas,
  // fuente documental, revisión elegida, tipo de cambio explícito y la indicación de usarlos --
  // las seis a la vez. Falta una y `resolveHardwareCost` devuelve null, con lo que se conserva la
  // estimación de arriba sin cambiar ni un peso. Hoy es null siempre: no hay manual MACO que
  // pruebe ninguna relación, así que supplier_hardware_mappings está vacía. Ver lib/maco/costing.ts.
  const verifiedHardware = resolveHardwareCost(hardwareCosting);
  const accessories = verifiedHardware
    ? verifiedHardware.totalMxn
    : sys.hardware + hardwareLeafCount * 110 + rail * 165;
  const addons = leaves.reduce((a, l) => a + (l.spec.mallorquina ? mallorquinaCost(l.wMm / 1000, l.hMm / 1000) : 0), 0);
  const consumables = (profileCost + glassCost) * 0.045;
  // Mano de obra de taller: cortar, soldar, limpiar esquinas, herrar y acristalar. No existía
  // ninguna partida por esto, así que el margen mostrado no era el margen obtenido. Es distinta
  // de `installation` (montaje en obra) y `transport` (flete), que se cotizan por pieza aparte.
  const labor = area * laborPerM2;
  const direct = profileCost + glassCost + reinforce + seals + accessories + addons + consumables + labor + installation + transport;
  const sale = (direct / (1 - margin / 100)) * (1 - discount / 100);
  // Los gastos fijos NO cambian el precio de venta: solo revelan cuánta de la utilidad bruta
  // queda de verdad al final. `utility` es contribución bruta y no los absorbe.
  const overhead = sale * (overheadPct / 100);

  // Real per-category bin-packing against the actual commercial bar length/kerf (configurable
  // via barLengthMm -- see the Consumo tab's "Longitud de barra" selector), instead of a flat
  // (frameM+sashM)/6m estimate that ignored kerf and ignored qty>1's opportunity to share bars
  // across units -- this now matches exactly what CorteDoc's cut-optimization report shows.
  const cutForBars = buildCutList(tree, width, height, sys, frames);
  const packedCategories = [cutForBars.marco, cutForBars.travesanos, cutForBars.hojas, cutForBars.junquillos, reinforcementPieces].map((pieces) => {
    const qtyPieces: CutPiece[] = [];
    for (let i = 0; i < qty; i++) qtyPieces.push(...pieces);
    return packBars(qtyPieces, barLength, KERF_MM);
  });
  const bars = packedCategories.reduce((a, bs) => a + bs.length, 0);
  const waste = packedCategories.reduce((a, bs) => a + bs.reduce((x, b) => x + b.waste, 0), 0) / 1000;

  return {
    w, h, area, perimeter, leaves, frameM, sashM, glassArea,
    profileCost, profileWasteCost, glassCost, reinforce, seals, accessories, hardwareLeafCount,
    hardwareVerified: verifiedHardware !== null, addons, consumables, labor,
    direct, sale, total: sale * qty, utility: (sale - direct) * qty,
    overhead: overhead * qty,
    netUtility: (sale - direct - overhead) * qty,
    netMarginPct: sale > 0 ? ((sale - direct - overhead) / sale) * 100 : 0,
    bars, waste,
  };
}

// ---------- CUT-LIST OPTIMIZER (real 1D bin packing, first-fit-decreasing) ----------
export const BAR_LENGTH_MM = 5800;
export const KERF_MM = 5;

export type CutPiece = { label: string; length: number; angle: string };
export type PackedBar = { pieces: CutPiece[]; used: number; waste: number };
export type CutList = { marco: CutPiece[]; travesanos: CutPiece[]; hojas: CutPiece[]; junquillos: CutPiece[] };

// El acumulado de cada barra se lleva incrementalmente en vez de recalcularse con un `reduce` por
// cada barra candidata y por cada pieza. Ese reduce anidado hacía que el costo creciera con el
// CUADRADO de las piezas multiplicado por las piezas que ya llevaba cada barra: medido, pasar de
// 100 a 1000 piezas multiplicaba el tiempo por 112. Un pedido de 50 ventanas iguales son ya ~800
// piezas por categoría, así que el caso grande es el normal, no el raro.
//
// `reserved` es EXACTAMENTE la cantidad que comprobaba el reduce que sustituye —suma de longitudes
// más un corte de sierra por pieza colocada— para que el empaquetado dé pieza por pieza el mismo
// resultado que antes. El `used` final sigue contando (n-1) cortes, como siempre. La diferencia
// entre ambos criterios es real y está registrada como defecto aparte (D-16): NO se corrige aquí,
// porque cambiaría las barras y la merma de cotizaciones ya emitidas.
export function packBars(pieces: CutPiece[], barLength: number, kerf: number): PackedBar[] {
  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  const bars: { pieces: CutPiece[]; reserved: number; cut: number }[] = [];
  for (const piece of sorted) {
    let placed = false;
    for (const bar of bars) {
      if (bar.reserved + piece.length <= barLength) {
        bar.pieces.push(piece);
        bar.reserved += piece.length + kerf;
        bar.cut += piece.length;
        placed = true;
        break;
      }
    }
    if (!placed) bars.push({ pieces: [piece], reserved: piece.length + kerf, cut: piece.length });
  }
  return bars.map((bar) => {
    const used = bar.cut + Math.max(0, bar.pieces.length - 1) * kerf;
    return { pieces: bar.pieces, used, waste: barLength - used };
  });
}

// Derives real cut pieces from the tree: 4 outer marco pieces regardless of splits, one
// travesaño per internal divider (its own actual cross-axis length), 4 hoja pieces per
// non-fixed/inactive leaf (fixed/inactive leaves glaze straight into marco/travesaño, no
// sash), and 4 junquillo (glazing bead) pieces per leaf.
// `leafFrames` es opcional y solo evita trabajo repetido: aplanar el árbol es la parte cara de esta
// función, y `calcQuote` ya lo hizo con exactamente los mismos argumentos unas líneas antes. Quien
// llame sin ese parámetro —los reportes y la exportación a CSV— se comporta igual que siempre.
export function buildCutList(
  tree: FrameNode,
  width: number,
  height: number,
  sys: System,
  leafFrames?: LeafFrame[]
): CutList {
  // Las piezas a 45° se sueldan, y la soldadora fresa cada extremo antes de unir: se cortan más
  // largas que su medida terminada. Es el `Medida Final + (F5*2)` de la hoja de material de Aluplast,
  // con F5 = 3 mm. Las piezas a 90° no se sueldan y van a su medida, igual que en esa misma hoja.
  const weld = 2 * WELD_ALLOWANCE_MM;
  const bead = beadFor(sys.name).deductionMm;
  const marco: CutPiece[] = [
    { label: "Marco: Abajo", length: width + weld, angle: "45°" },
    { label: "Marco: Arriba", length: width + weld, angle: "45°" },
    { label: "Marco: Izquierda", length: height + weld, angle: "45°" },
    { label: "Marco: Derecha", length: height + weld, angle: "45°" },
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
  (leafFrames ?? flattenToLeafFrames(tree, width, height, sys.frameSeatMm, sys.centerOverlapMm)).forEach((r, i) => {
    const label = `Hoja ${String.fromCharCode(65 + i)}`;
    const w = Math.round(r.fabW), h = Math.round(r.fabH);
    if (r.wing !== "fixed" && r.wing !== "inactive") {
      hojas.push(
        { label: `${label}: Arriba`, length: w + weld, angle: "45°" },
        { label: `${label}: Abajo`, length: w + weld, angle: "45°" },
        { label: `${label}: Izquierda`, length: h + weld, angle: "45°" },
        { label: `${label}: Derecha`, length: h + weld, angle: "45°" }
      );
    }
    // El junquillo va a 45°, no a 90°: así lo corta la hoja de material de Aluplast. Y se aloja
    // DENTRO del galce, así que mide menos que la hoja -- `bead` es ese descuento, por sistema.
    // Sin calibrar vale 0 y el junquillo sale a la medida de la hoja, que es como estaba; el reporte
    // de corte lo advierte en vez de callarlo. Nunca lleva descuento de soldadura: no se suelda.
    const bw = Math.max(0, w - bead), bh = Math.max(0, h - bead);
    junquillos.push(
      { label: `${label}: Arriba`, length: bw, angle: "45°" },
      { label: `${label}: Abajo`, length: bw, angle: "45°" },
      { label: `${label}: Izquierda`, length: bh, angle: "45°" },
      { label: `${label}: Derecha`, length: bh, angle: "45°" }
    );
  });
  return { marco, travesanos, hojas, junquillos };
}
