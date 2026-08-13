import assert from "node:assert/strict";
import { test } from "node:test";
import { calcQuote } from "@/lib/calc";
import { resolveHardwareCost, type VerifiedHardwareCosting, type VerifiedHardwareLine } from "@/lib/maco/costing";
import { catalog } from "@/data/catalog";
import { glassCatalog } from "@/data/glass";
import { colors } from "@/data/colors";
import { defaultSpecFor } from "@/lib/tree";
import type { FrameNode, GlassSides, Marco, PaneSpec, Sides, WingType } from "@/types/domain";

// Lo que se prueba aquí es sobre todo una AUSENCIA: que importar la lista de precios MACO no haya
// cambiado ni un peso del cálculo actual. La lista trae artículos y precios, no una lista de
// materiales por ventana, así que no autoriza a sustituir la estimación de herrajes.

const sys = catalog.Aluplast[0];
const glass = glassCatalog[0];
const color = colors.Aluplast[0];

function sides(): Sides {
  return {
    top: { reinforcement: false, notes: "" },
    bottom: { reinforcement: false, notes: "" },
    left: { reinforcement: false, notes: "" },
    right: { reinforcement: false, notes: "" },
  };
}

function glassSides(): GlassSides {
  const side = { angulo1: 90, angulo2: 90, radio: 0, arco: 0, notes: "" };
  return { top: { ...side }, bottom: { ...side }, left: { ...side }, right: { ...side } };
}

/** PaneSpec completo: `defaultSpecFor` solo devuelve las diferencias respecto a la base. */
function spec(wing: WingType): PaneSpec {
  return {
    state: "",
    opening: "",
    direction: "",
    hardware: "Herraje estándar",
    handle: "",
    glass: "Heredar vidrio general",
    notes: "",
    mallorquina: false,
    sides: sides(),
    glassSides: glassSides(),
    pocketType: "",
    useGancho: false,
    useAdaptador: false,
    handlePosition: 0,
    profileCode: "",
    railIndex: 1,
    ...defaultSpecFor(wing),
  };
}

const marco: Marco = {
  profileCode: "",
  reinforcement: false,
  reinforcementCode: "",
  mosquitero: false,
  mosquiteroCode: "",
  persiana: false,
  persianaCode: "",
  sides: sides(),
};

function tree(): FrameNode {
  return {
    kind: "split",
    id: "root",
    axis: "col",
    ratios: [0.5, 0.5],
    children: [
      { kind: "leaf", id: "a", wing: "sliding", spec: spec("sliding") },
      { kind: "leaf", id: "b", wing: "sliding", spec: spec("sliding") },
    ],
  };
}

function baseParams() {
  return {
    width: 2000,
    height: 1400,
    qty: 1,
    tree: tree(),
    sys,
    glass,
    color,
    rail: 2,
    installation: 500,
    transport: 300,
    margin: 35,
    discount: 0,
    marco,
  };
}

/** Renglón completo y verificado. Las pruebas de abajo le quitan una condición cada vez. */
function verifiedLine(overrides: Partial<VerifiedHardwareLine> = {}): VerifiedHardwareLine {
  return {
    sku: "100528",
    description: "Manilla balconera de placa larga",
    qty: 2,
    unitPriceMinor: 1138,
    priceScale: 2,
    currency: "EUR",
    sourceRef: "Manual de montaje MACO corredera 60mm",
    sourceLocation: "página 4, tabla 2",
    verification: "verified",
    ...overrides,
  };
}

function fullCosting(overrides: Partial<VerifiedHardwareCosting> = {}): VerifiedHardwareCosting {
  return {
    revision: "ABR_22",
    eurMxn: 21.8,
    useVerifiedCosts: true,
    lines: [verifiedLine()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------------
// Sin mapeo verificado, calcQuote no cambia
// ---------------------------------------------------------------------------------------------

test("calcQuote sin lista de materiales conserva exactamente la estimación actual", () => {
  const params = baseParams();
  const result = calcQuote(params);

  // La fórmula de siempre: sys.hardware + tarifa plana por hoja con herraje + tarifa de riel.
  const expected = sys.hardware + result.hardwareLeafCount * 110 + params.rail * 165;
  assert.equal(result.accessories, expected);
  assert.equal(result.hardwareVerified, false);
});

test("pasar el parámetro sin las condiciones no altera el resultado", () => {
  const sinCosteo = calcQuote(baseParams());

  // Cada uno de estos casos le falta algo, así que todos deben dar el MISMO total que sin nada.
  const incompletos: (VerifiedHardwareCosting | undefined)[] = [
    undefined,
    fullCosting({ useVerifiedCosts: false }),
    fullCosting({ revision: "" }),
    fullCosting({ revision: "   " }),
    fullCosting({ eurMxn: 0 }),
    fullCosting({ eurMxn: Number.NaN }),
    fullCosting({ eurMxn: -21.8 }),
    fullCosting({ lines: [] }),
    fullCosting({ lines: [verifiedLine({ verification: "tentativo" })] }),
    fullCosting({ lines: [verifiedLine({ qty: 0 })] }),
    fullCosting({ lines: [verifiedLine({ sourceRef: "" })] }),
    fullCosting({ lines: [verifiedLine({ sourceLocation: "" })] }),
    fullCosting({ lines: [verifiedLine({ currency: "MXN" })] }),
    // Un solo renglón sin prueba invalida el costeo completo: no se mezcla verificado con estimado.
    fullCosting({ lines: [verifiedLine(), verifiedLine({ sku: "100529", sourceRef: "" })] }),
  ];

  for (const hardwareCosting of incompletos) {
    const result = calcQuote({ ...baseParams(), hardwareCosting });
    assert.equal(result.accessories, sinCosteo.accessories, `accessories cambió con ${JSON.stringify(hardwareCosting)}`);
    assert.equal(result.total, sinCosteo.total, "el total no debe cambiar sin evidencia suficiente");
    assert.equal(result.hardwareVerified, false);
  }
});

test("resolveHardwareCost devuelve null mientras falte cualquier condición", () => {
  assert.equal(resolveHardwareCost(undefined), null);
  assert.equal(resolveHardwareCost(fullCosting({ useVerifiedCosts: false })), null);
  assert.equal(resolveHardwareCost(fullCosting({ revision: "" })), null);
  assert.equal(resolveHardwareCost(fullCosting({ eurMxn: 0 })), null);
  assert.equal(resolveHardwareCost(fullCosting({ lines: [] })), null);
  assert.equal(resolveHardwareCost(fullCosting({ lines: [verifiedLine({ verification: "tentativo" })] })), null);
});

test("una revisión disponible no basta: hay que elegirla y encender el costeo", () => {
  // ABR_22 es la única revisión importada, y eso NO la vuelve la lista con la que se cotiza.
  // Sin `useVerifiedCosts` explícito, tener la revisión no cambia nada.
  const soloRevision = fullCosting({ useVerifiedCosts: false });
  assert.equal(resolveHardwareCost(soloRevision), null);

  const sinRevision = fullCosting({ revision: "" });
  assert.equal(resolveHardwareCost(sinRevision), null);
});

// ---------------------------------------------------------------------------------------------
// Con mapeo verificado y explícito, el costeo sí funciona
// ---------------------------------------------------------------------------------------------

test("con las seis condiciones calcula el costo verificado a partir del precio exacto", () => {
  const costing = fullCosting();
  const breakdown = resolveHardwareCost(costing);

  assert.ok(breakdown, "con todas las condiciones debe costear");
  // 11.38 EUR x 2 piezas x 21.8 MXN/EUR = 496.168
  assert.ok(Math.abs(breakdown.totalMxn - 496.168) < 1e-9, `total inesperado: ${breakdown.totalMxn}`);
  assert.equal(breakdown.revision, "ABR_22");
  assert.equal(breakdown.eurMxn, 21.8);
  assert.equal(breakdown.lines.length, 1);
  assert.equal(breakdown.lines[0].sku, "100528");
});

test("suma varios renglones verificados", () => {
  const breakdown = resolveHardwareCost(
    fullCosting({
      lines: [
        verifiedLine({ sku: "100528", qty: 2, unitPriceMinor: 1138, priceScale: 2 }),
        verifiedLine({ sku: "0012", qty: 8, unitPriceMinor: 15, priceScale: 2 }),
      ],
    })
  );
  assert.ok(breakdown);
  // 11.38*2*21.8 + 0.15*8*21.8 = 496.168 + 26.16 = 522.328
  assert.ok(Math.abs(breakdown.totalMxn - 522.328) < 1e-9, `total inesperado: ${breakdown.totalMxn}`);
});

test("calcQuote usa el costo verificado y lo declara cuando es completo", () => {
  const sinCosteo = calcQuote(baseParams());
  const conCosteo = calcQuote({ ...baseParams(), hardwareCosting: fullCosting() });

  assert.equal(conCosteo.hardwareVerified, true);
  assert.ok(Math.abs(conCosteo.accessories - 496.168) < 1e-9);
  assert.notEqual(conCosteo.accessories, sinCosteo.accessories);
  // El resto del cálculo no se toca: solo cambia el renglón de herrajes.
  assert.equal(conCosteo.profileCost, sinCosteo.profileCost);
  assert.equal(conCosteo.glassCost, sinCosteo.glassCost);
  assert.equal(conCosteo.seals, sinCosteo.seals);
  assert.equal(conCosteo.bars, sinCosteo.bars);
});

test("el precio verificado se calcula desde el entero exacto, sin la basura del Excel", () => {
  // Si el costeo partiera del double 11.379999999999999, el resultado arrastraría el error.
  const breakdown = resolveHardwareCost(
    fullCosting({ eurMxn: 1, lines: [verifiedLine({ qty: 1, unitPriceMinor: 1138, priceScale: 2 })] })
  );
  assert.ok(breakdown);
  assert.equal(breakdown.totalMxn, 11.38);
});
