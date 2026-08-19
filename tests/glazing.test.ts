import { strict as assert } from "node:assert";
import test from "node:test";
import { calcQuote } from "@/lib/calc";
import { glassSizeMm, glazingFor, LEGACY_GLASS_DEDUCTION_MM } from "@/data/glazing";
import { typologyDefs } from "@/data/typologies";
import { catalog } from "@/data/catalog";
import { colors } from "@/data/colors";
import { glassCatalog } from "@/data/glass";

// Estas pruebas existen por una razón concreta: la medida del pedido de vidrio salía de una
// constante de 120 mm repetida en tres archivos, igual para los veinte sistemas del catálogo y sin
// distinguir si la hoja acristala contra el marco o contra la hoja. Nadie lo vio durante meses
// porque NINGUNA prueba cubría el dimensionado de vidrio. Estas lo cubren.

const marco = {
  profileCode: "", reinforcement: false, reinforcementCode: "", mosquitero: false, mosquiteroCode: "",
  persiana: false, persianaCode: "",
  sides: {
    top: { reinforcement: false, notes: "" }, bottom: { reinforcement: false, notes: "" },
    left: { reinforcement: false, notes: "" }, right: { reinforcement: false, notes: "" },
  },
};

function quote(styleId: string, systemName: string, width: number, height: number, qty = 1) {
  const sysIndex = catalog.Aluplast.findIndex((s) => s.name === systemName);
  assert.ok(sysIndex >= 0, `el sistema ${systemName} tiene que existir en el catálogo`);
  const def = typologyDefs.find((t) => t.id === styleId);
  assert.ok(def, `la tipología ${styleId} tiene que existir`);
  return calcQuote({
    width, height, qty, tree: def.build(), sys: catalog.Aluplast[sysIndex],
    glass: glassCatalog[8], color: colors.Aluplast[0], rail: 2,
    installation: 0, transport: 0, margin: 42, discount: 0, marco,
  });
}

test("el descuento de vidrio depende de contra qué acristala la hoja, no solo del sistema", () => {
  // Es la distinción que la constante única no podía hacer: son perfiles distintos.
  const conMarco = glassSizeMm(1000, 1000, "CORREDERA 60MM", true);
  const conHoja = glassSizeMm(1000, 1000, "CORREDERA 60MM", false);
  const spec = glazingFor("CORREDERA 60MM");
  assert.equal(conMarco.wMm, 1000 - spec.marcoDeductionMm);
  assert.equal(conHoja.wMm, 1000 - spec.sashDeductionMm);
});

test("una hoja fija se dimensiona contra el marco y una operable contra la hoja", () => {
  const fija = quote("fijo-1", "CORREDERA 60MM", 1200, 1000);
  const movil = quote("corr-1", "CORREDERA 60MM", 1200, 1000);
  const spec = glazingFor("CORREDERA 60MM");
  assert.equal(fija.leaves[0].glassWMm, fija.leaves[0].wMm - spec.marcoDeductionMm);
  assert.equal(movil.leaves[0].glassWMm, movil.leaves[0].wMm - spec.sashDeductionMm);
});

test("CORREDERA 60MM está calibrado y conserva el valor con el que se cotizó siempre", () => {
  // Si esto cambia, cambian cotizaciones ya emitidas: tiene que ser una decisión explícita.
  const spec = glazingFor("CORREDERA 60MM");
  assert.equal(spec.calibrated, true);
  assert.equal(spec.marcoDeductionMm, LEGACY_GLASS_DEDUCTION_MM);
  assert.equal(spec.sashDeductionMm, LEGACY_GLASS_DEDUCTION_MM);
  assert.ok(spec.source.length > 20, "un sistema calibrado tiene que decir de dónde salió el número");
});

test("un sistema sin calibrar hereda el valor previo y queda marcado como tal", () => {
  const spec = glazingFor("Lift-slide 85 (HS)");
  assert.equal(spec.calibrated, false);
  assert.equal(spec.marcoDeductionMm, LEGACY_GLASS_DEDUCTION_MM);
  const size = glassSizeMm(908, 1384, "Lift-slide 85 (HS)", false);
  assert.equal(size.calibrated, false, "el cálculo tiene que propagar que el dato es provisional");
});

test("todo sistema del catálogo devuelve un descuento, calibrado o no", () => {
  for (const brand of ["Aluplast", "Deceuninck"] as const) {
    for (const sys of catalog[brand]) {
      const spec = glazingFor(sys.name);
      assert.ok(Number.isFinite(spec.marcoDeductionMm), `${sys.name} sin descuento de marco`);
      assert.ok(Number.isFinite(spec.sashDeductionMm), `${sys.name} sin descuento de hoja`);
      assert.ok(spec.marcoDeductionMm > 0 && spec.sashDeductionMm > 0, `${sys.name} con descuento no positivo`);
    }
  }
});

test("caso de referencia: corrediza de 2 hojas de 1800x1400 en CORREDERA 60MM", () => {
  // Medidas verificadas contra el producto corriendo el 2026-08-18 (ver REPORTE-FUNCIONAL.md):
  // hojas de 902x1384 por el asiento en marco de 8 mm y el traslape central de 20 mm.
  const c = quote("corr-2-moviles", "CORREDERA 60MM", 1800, 1400);
  assert.equal(c.leaves.length, 2);
  for (const leaf of c.leaves) {
    assert.equal(leaf.wMm, 902, "medida de fabricación de la hoja");
    assert.equal(leaf.hMm, 1384);
    assert.equal(leaf.glassWMm, 782, "vidrio = hoja menos el descuento del sistema");
    assert.equal(leaf.glassHMm, 1264);
  }
});

test("la superficie que se costea sale de la misma medida que el pedido de vidrio", () => {
  // Éste es el invariante que impedía el defecto original: mientras el costeo y el reporte
  // calculaban la resta por separado, podían desacoplarse sin que nada avisara.
  for (const def of typologyDefs) {
    const c = quote(def.id, "IDEAL 2000 · Practicable", 1600, 1300, 3);
    const suma = c.leaves.reduce((a, l) => a + (l.glassWMm / 1000) * (l.glassHMm / 1000), 0);
    assert.ok(
      Math.abs(c.glassArea - suma) < 1e-9,
      `${def.id}: el área costeada (${c.glassArea}) no coincide con la del pedido (${suma})`
    );
  }
});

test("una hoja más chica que el descuento da cero, no una medida negativa", () => {
  const size = glassSizeMm(80, 60, "CORREDERA 60MM", false);
  assert.equal(size.wMm, 0);
  assert.equal(size.hMm, 0);
});

test("el vidrio nunca sale más grande que la hoja que lo sujeta", () => {
  for (const brand of ["Aluplast", "Deceuninck"] as const) {
    for (const sys of catalog[brand]) {
      for (const def of typologyDefs) {
        const sysIndex = catalog[brand].findIndex((s) => s.name === sys.name);
        const c = calcQuote({
          width: 2000, height: 1600, qty: 1, tree: def.build(), sys: catalog[brand][sysIndex],
          glass: glassCatalog[8], color: colors[brand][0], rail: 2,
          installation: 0, transport: 0, margin: 42, discount: 0, marco,
        });
        for (const leaf of c.leaves) {
          assert.ok(leaf.glassWMm < leaf.wMm, `${sys.name}/${def.id}: vidrio más ancho que la hoja`);
          assert.ok(leaf.glassHMm < leaf.hMm, `${sys.name}/${def.id}: vidrio más alto que la hoja`);
        }
      }
    }
  }
});
