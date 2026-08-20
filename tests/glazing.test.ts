import { strict as assert } from "node:assert";
import test from "node:test";
import { buildCutList, calcQuote } from "@/lib/calc";
import { beadFor, glassSizeMm, glazingFor, leafSizingFor, LEGACY_GLASS_DEDUCTION_MM, WELD_ALLOWANCE_MM } from "@/data/glazing";
import { typologyDefs } from "@/data/typologies";
import { catalog, EUR_MXN, IMPORT_FACTOR } from "@/data/catalog";
import { colors } from "@/data/colors";
import { glassCatalog } from "@/data/glass";
import { buildPublicCatalog } from "@/lib/publicCatalog";

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

test("CORREDERA 96MM lleva el descuento documentado por Aluplast, no el heredado", () => {
  // 30 mm sale de seis tablas oficiales de "Deduction dimensions" (multi-slide págs. 24, 27, 88 y
  // 89; easy-slide págs. 55 y 57). Si esto cambia, cambian precios ya cotizados: tiene que ser una
  // decisión explícita y documentada en `source`.
  const spec = glazingFor("CORREDERA 96MM");
  assert.equal(spec.calibrated, true);
  assert.equal(spec.marcoDeductionMm, 30);
  assert.equal(spec.sashDeductionMm, 30);
  assert.notEqual(spec.marcoDeductionMm, LEGACY_GLASS_DEDUCTION_MM, "no debe volver al valor heredado");
  assert.match(spec.source, /multi-slide/i, "un sistema calibrado tiene que citar su fuente");
});

test("CORREDERA 60MM ya no se declara calibrado", () => {
  // Su 120 mm era el valor histórico de la aplicación, no una medición. Con los manuales de
  // Aluplast dando 30 mm para correderas, afirmar que está calibrado seria peor que admitir que no
  // lo está: sigue usando el valor heredado, pero el pedido de vidrio ahora lo advierte.
  const spec = glazingFor("CORREDERA 60MM");
  assert.equal(spec.calibrated, false);
  assert.equal(spec.sashDeductionMm, LEGACY_GLASS_DEDUCTION_MM);
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

// ---------- Descuento de soldadura y junquillos (D-06, D-07, D-09) ----------
// Datos de la hoja "CALCULO DE MATERIAL SISTEMA IS v2.1" de Aluplast, confirmados por dc el
// 2026-08-19 como los que usa el taller.

test("las piezas soldadas a 45° llevan el descuento de soldadura por extremo", () => {
  const cut = buildCutList(typologyDefs[0].build(), 2400, 1800, catalog.Aluplast[0]);
  const w = 2 * WELD_ALLOWANCE_MM;
  // Marco: dos piezas al ancho y dos al alto, todas a inglete y soldadas.
  for (const pieza of cut.marco) {
    assert.equal(pieza.angle, "45°");
    assert.ok(pieza.length === 2400 + w || pieza.length === 1800 + w, `marco sin soldadura: ${pieza.length}`);
  }
});

test("las piezas a 90° no llevan descuento de soldadura, porque no se sueldan", () => {
  // Un travesaño va a tope, no soldado a inglete: sale a su medida. Mismo criterio que la hoja de
  // material de Aluplast, donde solo las piezas a 45° pasan por la columna "Medida con Soldadura".
  const cut = buildCutList(typologyDefs.find((t) => t.id === "corr-2-moviles")!.build(), 2400, 1800, catalog.Aluplast[0]);
  assert.ok(cut.travesanos.length > 0, "esta tipología tiene que producir travesaño");
  for (const pieza of cut.travesanos) {
    assert.equal(pieza.angle, "90°");
    assert.equal(pieza.length, 1800, "el travesaño no debe crecer por soldadura");
  }
});

test("el junquillo va a 45° y nunca lleva descuento de soldadura", () => {
  const sys = catalog.Aluplast[0];
  const cut = buildCutList(typologyDefs.find((t) => t.id === "corr-2-moviles")!.build(), 2400, 1800, sys);
  const hojaLens = new Set(cut.hojas.map((p) => p.length));
  for (const pieza of cut.junquillos) {
    assert.equal(pieza.angle, "45°", "Aluplast corta el junquillo a inglete, no a 90°");
    assert.ok(!hojaLens.has(pieza.length) || beadFor(sys.name).deductionMm === 0,
      "con descuento calibrado el junquillo no puede medir lo mismo que la hoja");
  }
});

test("el junquillo se descuenta cuando su sistema está calibrado", () => {
  // Referencia del fabricante (sistema Ideal IS): junquillo = hoja - (47.3-2.8)*2 = hoja - 89.
  // Mientras ningún sistema del catálogo tenga ese dato, el descuento es 0 y queda advertido.
  for (const brand of ["Aluplast", "Deceuninck"] as const) {
    for (const sys of catalog[brand]) {
      const b = beadFor(sys.name);
      assert.ok(b.deductionMm >= 0, `${sys.name}: descuento de junquillo negativo`);
      if (!b.calibrated) assert.equal(b.deductionMm, 0, `${sys.name}: sin calibrar debe valer 0`);
      assert.ok(b.source.length > 10, `${sys.name}: el descuento de junquillo tiene que decir su origen`);
    }
  }
});

test("la soldadura no altera el precio, solo la lista de corte", () => {
  // profileCost sale de metros NETOS con la merma de DEFAULT_WASTE_PCT, que ya absorbe el material
  // consumido de más. Sumar la soldadura también ahí sería contarla dos veces.
  const c = quote("corr-2-moviles", "CORREDERA 60MM", 1800, 1400, 2);
  const neto = (c.frameM * catalog.Aluplast[0].frame + c.sashM * catalog.Aluplast[0].sash);
  assert.ok(neto > 0);
  assert.ok(c.profileCost > neto * 1.1, "la merma debe seguir aplicándose sobre el neto");
  assert.ok(Number.isFinite(c.total) && c.total > 0);
});

// ---------- Sistema IDEAL IS · Corredera mx ----------
// Añadido el 2026-08-19 desde la documentación de Aluplast. Es el único sistema del catálogo con
// ficha de fabricación propia, y el primero que usa `leafSizingFor` en lugar del modelo genérico.

const IS = "IDEAL IS · Corredera mx";

test("el sistema IS existe en el catálogo con los datos de su ficha", () => {
  const sys = catalog.Aluplast.find((s) => s.name === IS);
  assert.ok(sys, "el sistema IS tiene que estar en el catálogo");
  assert.equal(sys.depth, 58, "«Marco de 58 mm 2 rieles IS» en la lista de precios");
  assert.equal(sys.maxW, 1500, "manual «Ventana corredera mx» 2025-10, pág. 2");
  assert.equal(sys.maxH, 1500);
  assert.equal(sys.sourced, true, "sus precios salen de la lista vigente del proveedor");
});

test("el IS reproduce exactamente las medidas de deducción de su manual", () => {
  // Manual Aluplast «Ventana corredera mx», ed. 2025-10, págs. 6 y 7, con B=1800 y H=1400:
  //   Hoja             C = (B/2) − 52,2 = 847,8      I = H − 74   = 1326
  //   Acristalamiento  E = (B/2) − 71,6 = 828,4      K = H − 93,4 = 1306,6
  const c = quote("corr-2-fija-movil", IS, 1800, 1400);
  assert.equal(c.leaves.length, 2);
  for (const l of c.leaves) {
    assert.ok(Math.abs(l.wMm - 847.8) < 1e-9, `hoja ancho ${l.wMm} debería ser 847.8`);
    assert.ok(Math.abs(l.hMm - 1326) < 1e-9, `hoja alto ${l.hMm} debería ser 1326`);
    assert.ok(Math.abs(l.glassWMm - 828.4) < 1e-9, `vidrio ancho ${l.glassWMm} debería ser 828.4`);
    assert.ok(Math.abs(l.glassHMm - 1306.6) < 1e-9, `vidrio alto ${l.glassHMm} debería ser 1306.6`);
    assert.equal(l.glassCalibrated, true);
  }
});

test("el junquillo del IS se descuenta y el marco lleva soldadura", () => {
  const sys = catalog.Aluplast.find((s) => s.name === IS)!;
  const def = typologyDefs.find((t) => t.id === "corr-2-fija-movil")!;
  const cut = buildCutList(def.build(), 1800, 1400, sys);
  const w = 2 * WELD_ALLOWANCE_MM;
  // Marco: medida del elemento más la soldadura.
  assert.ok(cut.marco.some((p) => Math.abs(p.length - (1800 + w)) < 1e-9), "marco 1800+6");
  assert.ok(cut.marco.some((p) => Math.abs(p.length - (1400 + w)) < 1e-9), "marco 1400+6");
  // Junquillo: hoja menos 89, y SIN soldadura. La lista de corte trabaja en milímetros enteros
  // (buildCutList redondea la medida de fabricación antes de despiezar), así que 848 − 89 = 759.
  assert.equal(beadFor(IS).deductionMm, 89);
  assert.ok(cut.junquillos.some((p) => p.length === 759), `junquillo 759, hay ${cut.junquillos.map((p) => p.length).join()}`);
  assert.ok(!cut.junquillos.some((p) => p.length === 848 + w), "el junquillo no debe llevar soldadura");
  for (const p of cut.junquillos) assert.equal(p.angle, "45°");
});

test("NINGÚN sistema anterior al IS usa dimensionado propio de hoja", () => {
  // Ésta es la garantía que pidió dc: añadir el IS sin interferir con los demás. Cualquier sistema
  // que gane un dimensionado propio cambia sus medidas de hoja, y por tanto su precio, así que tiene
  // que ser una decisión explícita que rompa esta prueba a propósito.
  const conDimensionadoPropio = [IS];
  for (const brand of ["Aluplast", "Deceuninck"] as const) {
    for (const sys of catalog[brand]) {
      const propio = leafSizingFor(sys.name) !== null;
      if (conDimensionadoPropio.includes(sys.name)) {
        assert.equal(propio, true, `${sys.name} debería tener dimensionado propio`);
      } else {
        assert.equal(propio, false, `${sys.name} no debe tener dimensionado propio sin decidirlo`);
      }
    }
  }
});

test("el dimensionado propio no altera el modelo genérico de un sistema vecino", () => {
  // El caso de referencia de CORREDERA 60MM tiene que seguir dando 902x1384 con el IS ya en el
  // catálogo: son 8 mm de asiento y 20 de traslape, no el descuento del IS.
  const c = quote("corr-2-moviles", "CORREDERA 60MM", 1800, 1400);
  for (const l of c.leaves) {
    assert.equal(l.wMm, 902);
    assert.equal(l.hMm, 1384);
  }
});

// ---------- Dos decisiones de negocio, fijadas a propósito ----------

test("el tipo de cambio se mantiene en 21.8 por decisión de negocio", () => {
  // dc lo fijó el 2026-08-19: «mantén los 21 porque es el precio que maneja la marca para evitar
  // pérdidas». El mercado rondaba 19.68 ese día, así que este valor cotiza el perfil ~10.8% por
  // encima del tipo spot, deliberadamente, como colchón de divisa.
  //
  // Esta prueba existe para que no se pueda mover por descuido. Y hay una razón concreta para el
  // cuidado: IMPORT_FACTOR vale 1.0, o sea que el precio EXWORK se cobra como costo puesto en planta.
  // Bajar el tipo de cambio a spot dejando ese factor en 1.0 quitaría el colchón sin poner nada en su
  // lugar. Los dos números se revisan juntos o no se revisan.
  assert.equal(EUR_MXN, 21.8, "cambiar el tipo de cambio es una decisión de negocio, no técnica");
  assert.equal(IMPORT_FACTOR, 1.0, "si esto cambia, hay que revisar EUR_MXN en el mismo movimiento");
});

test("el sistema IS NO se expone en el cotizador público", () => {
  // Decisión de dc el 2026-08-19: el IS es para que el arquitecto lo diseñe en la aplicación
  // interna, no para el cliente final. Además su paquete de herraje aún no está validado, así que
  // exponerlo permitiría cotizarlo por debajo de costo.
  const publico = JSON.stringify(buildPublicCatalog());
  assert.ok(!/IDEAL IS/.test(publico), "el nombre del sistema IS no debe cruzar al navegador");
  assert.ok(!/Corredera mx/.test(publico), "ni su denominación");
  // Y sí tiene que estar disponible internamente, que es el objetivo.
  assert.ok(catalog.Aluplast.some((s) => s.name === IS), "el IS debe existir en el catálogo interno");
});

test("el galce del IS acepta 6 mm, no los 24 del catálogo de vidrio", () => {
  // El plano de liberación 020072-01 (sliding-window mx) dice «glazing bead for 3mm glass»; el de la
  // puerta 020074-01, con el MISMO junquillo 020073, dice «glazing bead for 6mm glass». Los dos
  // añaden «laminated is not planned». 6 es el máximo que respalda cualquier documento del sistema.
  //
  // Estuvo en 24 --el máximo del catálogo de vidrio-- porque la ficha de usuario no publica el dato.
  // Era un error grave: permitía cotizar DVH de 24 mm en un sistema que acepta 6, y el vidrio a
  // medida no se devuelve.
  const sys = catalog.Aluplast.find((s) => s.name === IS)!;
  assert.equal(sys.glazing, 6, "subirlo permite cotizar vidrio que no entra en el galce");
});

test("en el IS los vidrios gruesos y los DVH quedan fuera del galce", () => {
  const sys = catalog.Aluplast.find((s) => s.name === IS)!;
  const cabe = (nombre: string) => {
    const g = glassCatalog.find((x) => x.name === nombre);
    assert.ok(g, `la partida ${nombre} tiene que existir en el catálogo`);
    return g.thickness <= sys.glazing;
  };
  assert.equal(cabe("Cristal recocido claro 6 mm"), true, "el sencillo de 6 mm sí entra");
  assert.equal(cabe("Cristal templado claro 6 mm"), true, "el templado de 6 mm sí entra");
  assert.equal(cabe("DVH 20 mm · 4/12/4"), false, "un DVH no entra en este sistema");
  assert.equal(cabe("DVH 24 mm · 6/12/6"), false, "un DVH no entra en este sistema");
  assert.equal(cabe("Laminado 6+6 mm"), false, "«laminated is not planned» en la ficha de liberación");
  assert.equal(cabe("Cristal recocido claro 9.5 mm"), false);
});

test("el IS no declara prestaciones certificadas", () => {
  // El plano 020072-01 dice literalmente «no requirement for compatibility, U-value, water
  // resistance, wind load, burglary resistance and certification». Es una línea económica para
  // competir con aluminio sin RPT, y NO se puede especificar donde se exija clasificación NMX-R-060
  // ni prestación térmica declarada. El campo `uf` tiene que decirlo, no mostrar un valor inventado.
  const sys = catalog.Aluplast.find((s) => s.name === IS)!;
  assert.doesNotMatch(sys.uf, /W\/m/, "no puede exhibir un valor U que el fabricante no declara");
  assert.match(sys.uf, /sin requisito|sin certifica/i, "tiene que decir que no hay valor U");
});
