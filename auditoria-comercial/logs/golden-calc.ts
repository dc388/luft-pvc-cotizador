/**
 * Salida dorada del motor de cálculo. Se corre ANTES y DESPUÉS de optimizar: cualquier diferencia
 * significa que la optimización cambió un número que entra al costeo, y eso no es una optimización
 * sino un cambio de precio.
 */
import { calcQuote, packBars, buildCutList, BAR_LENGTH_MM, KERF_MM, type CutPiece } from "@/lib/calc";
import { typologyDefs } from "@/data/typologies";
import { catalog } from "@/data/catalog";
import { colors } from "@/data/colors";
import { glassCatalog } from "@/data/glass";

const marco = {
  profileCode: "", reinforcement: false, reinforcementCode: "", mosquitero: false, mosquiteroCode: "",
  persiana: false, persianaCode: "",
  sides: {
    top: { reinforcement: false, notes: "" }, bottom: { reinforcement: false, notes: "" },
    left: { reinforcement: false, notes: "" }, right: { reinforcement: false, notes: "" },
  },
};

function treeFor(id: string) {
  return (typologyDefs.find((t) => t.id === id) ?? typologyDefs[0]).build();
}

const out: string[] = [];

// Todas las tipologías, dos marcas, varias cantidades y medidas.
for (const brand of ["Aluplast", "Deceuninck"] as const) {
  for (let s = 0; s < catalog[brand].length; s++) {
    for (const def of typologyDefs) {
      for (const [w, h, qty] of [[1200, 1000, 1], [1800, 1400, 7], [3000, 2200, 23]] as const) {
        const c = calcQuote({
          width: w, height: h, qty, tree: treeFor(def.id),
          sys: catalog[brand][s], glass: glassCatalog[8], color: colors[brand][0],
          rail: 2, installation: 1200, transport: 450, margin: 42, discount: 0, marco,
        });
        out.push([
          brand, s, def.id, w, h, qty,
          c.frameM.toFixed(6), c.sashM.toFixed(6), c.glassArea.toFixed(6),
          c.profileCost.toFixed(6), c.glassCost.toFixed(6), c.reinforce.toFixed(6),
          c.seals.toFixed(6), c.accessories.toFixed(6), c.addons.toFixed(6),
          c.consumables.toFixed(6), c.labor.toFixed(6), c.direct.toFixed(6),
          c.sale.toFixed(6), c.total.toFixed(6), c.utility.toFixed(6),
          c.netUtility.toFixed(6), c.bars, c.waste.toFixed(6),
          // El id de hoja es un UUID aleatorio por construccion del arbol: se omite a proposito
          // para que la salida sea comparable entre corridas.
          c.leaves.map((l) => `${l.wing}:${l.wMm}x${l.hMm}:${l.glassArea.toFixed(5)}:${l.sashPerimeter.toFixed(5)}`).join(","),
        ].join("|"));
      }
    }
  }
}

// packBars aislado, con conjuntos deterministas: se compara barra por barra y pieza por pieza.
function pieces(n: number, seed: number): CutPiece[] {
  const p: CutPiece[] = [];
  for (let i = 0; i < n; i++) p.push({ label: `P${i}`, length: 300 + ((i * seed) % 5400), angle: "45°" });
  return p;
}
for (const n of [1, 2, 3, 7, 33, 100, 257, 1000]) {
  for (const seed of [137, 991, 7]) {
    for (const bar of [5800, 6000, 4000]) {
      const bars = packBars(pieces(n, seed), bar, KERF_MM);
      out.push(`PACK|${n}|${seed}|${bar}|${bars.length}|` +
        bars.map((b) => `${b.used}/${b.waste}:${b.pieces.map((x) => x.length).join(".")}`).join(";"));
    }
  }
}

// buildCutList: longitudes y ángulos exactos por categoría.
for (const def of typologyDefs) {
  const cut = buildCutList(treeFor(def.id), 2400, 1800, catalog.Aluplast[0]);
  out.push(`CUT|${def.id}|` + (["marco", "travesanos", "hojas", "junquillos"] as const)
    .map((k) => `${k}=${cut[k].map((p) => `${p.length}@${p.angle}`).join(".")}`).join("|"));
}

// Barra comercial por omisión: si cambia, el despiece cambia.
out.push(`CONST|BAR=${BAR_LENGTH_MM}|KERF=${KERF_MM}`);

console.log(out.join("\n"));
console.error(`lineas: ${out.length}`);
