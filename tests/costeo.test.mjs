import assert from "node:assert/strict";
import test, { before } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// lib/calc.ts es TypeScript y usa el alias `@/`, así que se empaqueta en memoria en vez de
// depender de que `npm run build` haya corrido antes: son aserciones aritméticas sobre el motor
// de costeo y no necesitan el artefacto de Sites completo.
//
// Se empaqueta también lib/tree.ts para armar las piezas con los mismos constructores que usa la
// app (defaultMarco, defaultSides...). Escribirlas a mano aquí las dejaría desincronizadas del
// día en que alguien agregue un campo, y la prueba fallaría por el fixture y no por el costeo.
let calc;
let tree;
before(async () => {
  // fileURLToPath y no `url.pathname`: en Windows el pathname llega como
  // "/C:/Users/.../LUFT%20PVC/" y esbuild no resuelve ni la barra inicial ni el %20.
  const root = fileURLToPath(new URL("../", import.meta.url));
  const result = await build({
    entryPoints: [`${root}lib/calc.ts`, `${root}lib/tree.ts`],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    outdir: "out",
    alias: { "@": root.replace(/\/$/, "") },
  });
  const load = async (name) => {
    const file = result.outputFiles.find((f) => f.path.endsWith(`${name}.js`));
    return import(`data:text/javascript;base64,${Buffer.from(file.text).toString("base64")}`);
  };
  calc = await load("calc");
  tree = await load("tree");
});

const spec = (mallorquina = false) => ({
  state: "Móvil", opening: "", direction: "", hardware: "Herraje estándar", handle: "",
  glass: "Heredar vidrio general", notes: "",
  ...tree.defaultSpecFor("sliding"),
  mallorquina,
  sides: tree.defaultSides(),
  glassSides: tree.defaultGlassSides(),
  pocketType: "", useGancho: false, useAdaptador: false, handlePosition: 0,
});

const twoLeafTree = (mallorquina = false) => ({
  kind: "split", id: "root", axis: "col", ratios: [0.5, 0.5],
  children: [
    { kind: "leaf", id: "a", wing: "sliding", spec: spec(mallorquina) },
    { kind: "leaf", id: "b", wing: "sliding", spec: spec(mallorquina) },
  ],
});

// CORREDERA 60MM en blanco con DVH 24 mm — la configuración por omisión del cotizador público.
// frameSeatMm / centerOverlapMm son la geometría de fabricación de corredera que el motor usa
// para el tamaño real de cada hoja (ver flattenToLeafFrames).
const sys = { name: "CORREDERA 60MM", frame: 74, sash: 75, hardware: 950, frameSeatMm: 8, centerOverlapMm: 34 };
const glass = { name: "DVH 24 mm", price: 1650 };
const color = { name: "Blanco", factor: 1 };
const base = () => ({
  width: 1500, height: 1200, qty: 1, sys, glass, color,
  rail: 2, installation: 1200, transport: 450, margin: 35, discount: 0,
  marco: tree.defaultMarco(),
});

const quote = (over = {}) => calc.calcQuote({ ...base(), tree: twoLeafTree(), ...over });

test("la merma de perfil se cobra y es separable del perfil neto", () => {
  const sinMerma = quote({ wastePct: 0 });
  const conMerma = quote({ wastePct: 12 });

  assert.equal(sinMerma.profileWasteCost, 0);
  assert.ok(conMerma.profileCost > sinMerma.profileCost, "12% de merma debe encarecer el perfil");
  // profileCost = neto * 1.12, luego merma = profileCost * 12/112
  assert.ok(Math.abs(conMerma.profileWasteCost - conMerma.profileCost * (12 / 112)) < 0.01);
  assert.ok(Math.abs(conMerma.profileCost - sinMerma.profileCost * 1.12) < 0.01);
});

test("la mano de obra de taller entra al costo directo y escala con el área", () => {
  const sinMO = quote({ laborPerM2: 0 });
  const conMO = quote({ laborPerM2: 225 });

  assert.equal(sinMO.labor, 0);
  assert.ok(Math.abs(conMO.labor - conMO.area * 225) < 0.01);
  assert.ok(Math.abs(conMO.direct - sinMO.direct - conMO.labor) < 0.01, "la MO debe sumar al directo");
  assert.ok(conMO.sale > sinMO.sale, "un costo directo mayor debe subir el precio de venta");
});

test("la tarifa de mano de obra corresponde a la nómina real del taller", () => {
  // 2 operarios x $1,000/día en mano, +40% carga social = $1,400/día de costo real.
  // Ritmo normal 3-4 ventanas/día ≈ 6.3 m²/día (ventana promedio 1.8 m²).
  const costoDiarioReal = 1000 * 1.4;
  const m2PorDia = 3.5 * 1.8;
  const tarifaDerivada = costoDiarioReal / m2PorDia;

  assert.ok(
    Math.abs(calc.DEFAULT_LABOR_MXN_PER_M2 - tarifaDerivada) < 5,
    `la tarifa por defecto (${calc.DEFAULT_LABOR_MXN_PER_M2}) debe seguir la nómina real (~${tarifaDerivada.toFixed(0)})`
  );
});

test("el costeo y el optimizador de corte cuentan barras de la misma longitud", () => {
  const q = quote();
  const barM = calc.BAR_LENGTH_MM / 1000;
  const lineal = q.frameM + q.sashM;

  assert.equal(calc.BAR_LENGTH_MM, 5800);
  // El motor empaqueta las piezas reales por categoría (marco, travesaños, hojas, junquillos,
  // refuerzo) con la sierra descontada, así que nunca puede necesitar MENOS barras que el
  // reparto continuo ideal del lineal total. Esa desigualdad es la que ata el costeo a la misma
  // longitud de barra que el despiece: si el costeo usara 6,000 mm, saldría por debajo del piso.
  assert.ok(q.bars >= Math.ceil(lineal / barM), "el empaquetado real no puede bajar del piso ideal");
  assert.ok(q.waste >= 0, "el remanente no puede ser negativo");

  // Y una barra comercial más larga no puede necesitar más barras que una más corta.
  assert.ok(quote({ barLengthMm: 12000 }).bars <= q.bars);
});

test("la mallorquina escala con la altura, no solo con el ancho", () => {
  const baja = calc.calcQuote({ ...base(), tree: twoLeafTree(true), height: 600 });
  const alta = calc.calcQuote({ ...base(), tree: twoLeafTree(true), height: 1800 });

  assert.ok(baja.addons > 0);
  assert.ok(alta.addons > baja.addons * 2, "el triple de altura debe llevar ~el triple de lamas");

  // La tarifa plana anterior era ancho * 47 * 2 por hoja; el costeo por lamas debe superarla
  // por casi un orden de magnitud en una hoja de altura normal.
  const q = calc.calcQuote({ ...base(), tree: twoLeafTree(true) });
  const tarifaPlanaVieja = 2 * (0.75 * 47 * 2);
  assert.ok(q.addons > tarifaPlanaVieja * 5, "el costeo por lamas debe superar la tarifa plana vieja");
});

test("la utilidad neta descuenta gastos fijos y queda por debajo de la bruta", () => {
  const q = quote({ overheadPct: 20 });

  assert.ok(Math.abs(q.overhead - q.sale * 0.2) < 0.01);
  assert.ok(Math.abs(q.netUtility - (q.utility - q.overhead)) < 0.01);
  assert.ok(q.netUtility < q.utility, "la neta nunca puede igualar a la bruta con overhead > 0");
  assert.ok(Math.abs(q.netMarginPct - (q.netUtility / q.sale) * 100) < 0.01);

  // Con 35% de margen y 20% de gastos fijos, lo que realmente queda es 15%.
  assert.ok(Math.abs(q.netMarginPct - 15) < 0.01);
});

test("los gastos fijos no alteran el precio de venta", () => {
  assert.equal(quote({ overheadPct: 0 }).sale, quote({ overheadPct: 40 }).sale);
});

test("todo escala linealmente con la cantidad", () => {
  const uno = quote({ qty: 1 });
  const cinco = quote({ qty: 5 });

  assert.ok(Math.abs(cinco.total - uno.total * 5) < 0.01);
  assert.ok(Math.abs(cinco.netUtility - uno.netUtility * 5) < 0.01);
  assert.equal(cinco.direct, uno.direct, "el directo se reporta por pieza");
});

test("los herrajes verificados de proveedor siguen sin activarse solos", () => {
  // El costeo de herrajes con precios MACO exige seis condiciones a la vez; sin ellas el motor
  // conserva la estimación. Que exista la partida de mano de obra no debe haber abierto esa
  // puerta por accidente. Ver lib/maco/costing.ts.
  assert.equal(quote().hardwareVerified, false);
  assert.equal(quote({ hardwareCosting: { useVerifiedCosts: true } }).hardwareVerified, false);
});
