import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecommendations,
  buildTemplates,
  distribution,
  emptyLearningStats,
  sanitizeEvent,
  summarize,
  type RecommendationContext,
} from "@/lib/learningRules";

// Lo que se prueba de la capa de mejora es exactamente lo que §9 exige que se cumpla: que no guarde
// datos personales, que no invente recomendaciones sin datos, que diga en qué se apoya y con cuánta
// confianza, y que nunca proponga cambiar un precio o un margen por su cuenta.

test("el filtro de eventos descarta cualquier campo que no esté permitido", () => {
  const clean = sanitizeEvent("componente_guardado", {
    typology: "Corrediza",
    widthMm: 1500,
    // Todo lo de abajo es dato personal o identificador, y NADA de esto puede quedar guardado.
    client: "Ana Ramírez",
    clientEmail: "ana@fabela.mx",
    clientPhone: "9932211158",
    clientAddress: "Av. Isidro Fabela 120",
    projectId: "proj-1",
    componentId: "comp-1",
    folio: "LP-2026-0007",
    requester: { fullName: "Ana Ramírez" },
    notes: "hablar con Ana el jueves",
  });

  assert.deepEqual(Object.keys(clean).sort(), ["typology", "widthMm"]);
  const serialized = JSON.stringify(clean);
  for (const leak of ["Ana", "ana@fabela.mx", "9932211158", "Isidro", "proj-1", "comp-1", "LP-2026-0007", "jueves"]) {
    assert.ok(!serialized.includes(leak), `se filtró "${leak}" a las estadísticas`);
  }
});

test("el filtro también respeta el tipo de cada campo permitido", () => {
  const clean = sanitizeEvent("componente_guardado", {
    typology: 42,
    widthMm: "1500",
    qty: Number.NaN,
    marginPct: 35,
    configState: "ok",
  });
  assert.equal("typology" in clean, false, "un número no entra donde se espera texto");
  assert.equal("widthMm" in clean, false, "un texto no entra donde se espera número");
  assert.equal("qty" in clean, false, "NaN no es un número guardable");
  assert.equal(clean.marginPct, 35);
  assert.equal(clean.configState, "ok");
});

test("un tipo de evento desconocido no tiene lista blanca y no guarda nada", () => {
  // @ts-expect-error -- se comprueba a propósito el caso que la ruta de API rechaza antes de llegar.
  assert.throws(() => sanitizeEvent("kind_inventado", { typology: "Corrediza" }));
});

test("los percentiles describen el grueso de los datos, no el caso extremo", () => {
  const spread = distribution([1000, 1100, 1200, 1200, 1300, 1400, 12000]);
  assert.equal(spread.count, 7);
  assert.equal(spread.min, 1000);
  assert.equal(spread.max, 12000);
  assert.equal(spread.median, 1200);
  // La ventana de 12 m mueve el promedio muy por encima de todo lo demás; la mediana no.
  assert.ok(spread.mean > 2000);
  assert.ok(spread.median < 2000);
  assert.deepEqual(distribution([]), { count: 0, min: 0, p10: 0, median: 0, p90: 0, max: 0, mean: 0 });
  assert.deepEqual(distribution([Number.NaN, Number.POSITIVE_INFINITY]).count, 0);
});

function saveEvent(payload: Record<string, string | number>, at = 1_780_000_000_000) {
  return { kind: "componente_guardado", payload, createdAt: at };
}

const baseContext: RecommendationContext = {
  typology: "Corrediza",
  systemName: "CORREDERA 60MM",
  glassName: "Templado 6 mm",
  widthMm: 1500,
  heightMm: 1200,
  qty: 2,
  marginPct: 35,
  discountPct: 0,
  hasClientName: true,
  hasClientContact: true,
  hasLocation: true,
  identicalSiblings: 0,
};

test("sin historial no se inventa ninguna recomendación estadística", () => {
  const out = buildRecommendations(emptyLearningStats(), baseContext);
  assert.deepEqual(out, [], "con cero datos no hay nada que sugerir");
});

test("los campos sin llenar se señalan aunque no haya ningún historial", () => {
  const out = buildRecommendations(emptyLearningStats(), {
    ...baseContext,
    hasClientName: false,
    hasClientContact: false,
    hasLocation: false,
  });
  const ids = out.map((entry) => entry.id);
  assert.ok(ids.includes("falta-solicitante"));
  assert.ok(ids.includes("falta-ubicacion"));
  // Sin nombre no se pide además el contacto: sería el mismo aviso dos veces.
  assert.ok(!ids.includes("falta-contacto"));
  // Son hechos comprobables del proyecto abierto, no inferencias: confianza alta y muestra cero.
  for (const entry of out) {
    assert.equal(entry.kind, "faltante");
    assert.equal(entry.confidence, "alta");
    assert.equal(entry.sampleSize, 0);
    assert.ok(entry.basis.length > 0, "toda recomendación tiene que decir en qué se apoya");
  }
});

test("cada recomendación dice en qué se apoya y con cuánta confianza según la muestra", () => {
  const few = summarize([
    saveEvent({ typology: "Corrediza", glassName: "Laminado 6+6", widthMm: 1500, heightMm: 1200, marginPct: 35 }),
    saveEvent({ typology: "Corrediza", glassName: "Laminado 6+6", widthMm: 1500, heightMm: 1200, marginPct: 35 }),
    saveEvent({ typology: "Corrediza", glassName: "Laminado 6+6", widthMm: 1500, heightMm: 1200, marginPct: 35 }),
  ]);
  const fewOut = buildRecommendations(few, baseContext);
  const fewGlass = fewOut.find((entry) => entry.id === "vidrio-habitual");
  assert.ok(fewGlass, "con tres casos ya se puede sugerir, marcándolo");
  assert.equal(fewGlass.confidence, "media");
  assert.equal(fewGlass.sampleSize, 3);
  assert.match(fewGlass.basis, /3 componente/);

  const many = summarize(
    Array.from({ length: 20 }, () =>
      saveEvent({ typology: "Corrediza", glassName: "Laminado 6+6", widthMm: 1500, heightMm: 1200, marginPct: 35 })
    )
  );
  const manyGlass = buildRecommendations(many, baseContext).find((entry) => entry.id === "vidrio-habitual");
  assert.ok(manyGlass);
  assert.equal(manyGlass.confidence, "alta");
  assert.deepEqual(manyGlass.suggestion, { field: "glassName", value: "Laminado 6+6" });
});

test("una medida fuera del rango habitual de SU tipología se avisa", () => {
  const stats = summarize([
    ...Array.from({ length: 10 }, () => saveEvent({ typology: "Abatible", widthMm: 800, heightMm: 1000 })),
    ...Array.from({ length: 10 }, () => saveEvent({ typology: "Corrediza", widthMm: 4000, heightMm: 2200 })),
  ]);

  // 4 m de ancho es normal en corrediza y no debe avisar.
  const sliding = buildRecommendations(stats, { ...baseContext, typology: "Corrediza", widthMm: 4000, heightMm: 2200 });
  assert.ok(!sliding.some((entry) => entry.id === "medida-inusual-ancho"));

  // Los mismos 4 m en abatible sí, porque se compara contra el histórico de abatibles.
  const casement = buildRecommendations(stats, { ...baseContext, typology: "Abatible", widthMm: 4000, heightMm: 1000 });
  const warning = casement.find((entry) => entry.id === "medida-inusual-ancho");
  assert.ok(warning, "una abatible de 4 m no se parece a ninguna abatible anterior");
  assert.equal(warning.kind, "aviso");
  assert.equal(warning.suggestion, undefined, "un aviso no propone ningún valor");
});

test("el margen y el descuento se avisan, nunca se cambian solos", () => {
  const stats = summarize(
    Array.from({ length: 15 }, () => saveEvent({ typology: "Corrediza", marginPct: 35, discountPct: 3, qty: 2 }))
  );

  const low = buildRecommendations(stats, { ...baseContext, marginPct: 18 });
  const marginWarning = low.find((entry) => entry.id === "margen-inusual");
  assert.ok(marginWarning);
  assert.equal(marginWarning.kind, "aviso");
  assert.equal(marginWarning.suggestion, undefined, "el margen es una decisión comercial: no se propone un valor");
  assert.match(marginWarning.detail, /35%/);

  const discounted = buildRecommendations(stats, { ...baseContext, discountPct: 18 });
  const discountWarning = discounted.find((entry) => entry.id === "descuento-inusual");
  assert.ok(discountWarning);
  assert.equal(discountWarning.suggestion, undefined);

  // Y en el caso normal ninguno de los dos aparece.
  const normal = buildRecommendations(stats, baseContext);
  assert.ok(!normal.some((entry) => entry.id === "margen-inusual" || entry.id === "descuento-inusual"));
});

test("ninguna recomendación propone tocar un precio", () => {
  const stats = summarize(
    Array.from({ length: 20 }, () =>
      saveEvent({ typology: "Corrediza", glassName: "Laminado 6+6", widthMm: 1500, heightMm: 1200, marginPct: 35, unitPrice: 8000, total: 16000 })
    )
  );
  const out = buildRecommendations(stats, { ...baseContext, marginPct: 12, discountPct: 19, qty: 900, identicalSiblings: 2 });
  for (const entry of out) {
    assert.ok(
      !entry.suggestion || ["glassName", "systemName", "typology", "qty"].includes(entry.suggestion.field),
      `una recomendación propuso cambiar ${entry.suggestion?.field}`
    );
  }
});

test("una cantidad muy por encima de lo habitual se cuestiona", () => {
  const stats = summarize(Array.from({ length: 12 }, () => saveEvent({ typology: "Corrediza", qty: 2 })));
  const out = buildRecommendations(stats, { ...baseContext, qty: 200 });
  assert.ok(out.some((entry) => entry.id === "cantidad-sospechosa"), "un cero de más en la cantidad es el error más caro");
  assert.ok(!buildRecommendations(stats, { ...baseContext, qty: 3 }).some((entry) => entry.id === "cantidad-sospechosa"));
});

test("los componentes idénticos del mismo proyecto se señalan con la cantidad que tendría la partida", () => {
  const out = buildRecommendations(emptyLearningStats(), { ...baseContext, qty: 2, identicalSiblings: 3 });
  const repeated = out.find((entry) => entry.id === "componentes-repetidos");
  assert.ok(repeated);
  assert.deepEqual(repeated.suggestion, { field: "qty", value: 5 });
});

test("el motivo de rechazo solo se reporta cuando hay cotizaciones cerradas de verdad", () => {
  const withoutOutcomes = summarize(Array.from({ length: 12 }, () => saveEvent({ typology: "Corrediza" })));
  assert.ok(!buildRecommendations(withoutOutcomes, baseContext).some((entry) => entry.id === "motivo-rechazo"));

  const withOutcomes = summarize([
    ...Array.from({ length: 12 }, () => saveEvent({ typology: "Corrediza" })),
    { kind: "cotizacion_resuelta", payload: { outcome: "rechazada", reason: "Precio" }, createdAt: 1 },
    { kind: "cotizacion_resuelta", payload: { outcome: "rechazada", reason: "Precio" }, createdAt: 2 },
    { kind: "cotizacion_resuelta", payload: { outcome: "aceptada" }, createdAt: 3 },
  ]);
  assert.equal(withOutcomes.outcomes.accepted, 1);
  assert.equal(withOutcomes.outcomes.rejected, 2);
  const reason = buildRecommendations(withOutcomes, baseContext).find((entry) => entry.id === "motivo-rechazo");
  assert.ok(reason);
  assert.match(reason.title, /Precio/);
});

test("del cierre de obra solo entran desviaciones, nunca los importes de la obra", () => {
  const clean = sanitizeEvent("obra_cerrada", {
    costDeviationPct: 12.4,
    realMarginPct: 28,
    piecesDeviationPct: -5,
    // Nada de esto puede quedar guardado: son cifras y datos de una obra concreta.
    actualCost: 184000,
    actualRevenue: 240000,
    quotedTotal: 163000,
    projectId: "proj-1",
    client: "Ana Ramírez",
    notes: "se repuso un vidrio de la recámara de Ana",
  });
  assert.deepEqual(Object.keys(clean).sort(), ["costDeviationPct", "piecesDeviationPct", "realMarginPct"]);
  const serialized = JSON.stringify(clean);
  for (const leak of ["184000", "240000", "163000", "proj-1", "Ana", "vidrio"]) {
    assert.ok(!serialized.includes(leak), `se filtró "${leak}" a las estadísticas`);
  }
});

test("sin obras cerradas no se dice nada del costo real: no se estima", () => {
  const stats = summarize(Array.from({ length: 20 }, () => saveEvent({ typology: "Corrediza", marginPct: 35 })));
  assert.equal(stats.closedProjects, 0);
  assert.equal(stats.costDeviationPct.count, 0);
  const out = buildRecommendations(stats, baseContext);
  assert.ok(!out.some((entry) => entry.id === "desvio-costo-real"));
  assert.ok(!out.some((entry) => entry.id === "desvio-piezas-fabricadas"));
});

test("con obras cerradas se avisa del desvío de costo, con su magnitud medida y sin tocar el precio", () => {
  const closed = (costDeviationPct: number, piecesDeviationPct = 0) => ({
    kind: "obra_cerrada",
    payload: { costDeviationPct, realMarginPct: 25, piecesDeviationPct },
    createdAt: 1_780_000_000_000,
  });
  const stats = summarize([
    ...Array.from({ length: 6 }, () => saveEvent({ typology: "Corrediza", marginPct: 35 })),
    closed(11), closed(13), closed(12), closed(9), closed(14),
  ]);

  assert.equal(stats.closedProjects, 5);
  assert.equal(stats.costDeviationPct.median, 12);

  const warning = buildRecommendations(stats, baseContext).find((entry) => entry.id === "desvio-costo-real");
  assert.ok(warning, "cinco obras cerradas con el costo 12% arriba es algo que hay que decir");
  assert.equal(warning.kind, "aviso");
  assert.equal(warning.suggestion, undefined, "avisa del desvío; subir el precio no lo decide la plataforma");
  assert.match(warning.title, /12%/);
  assert.match(warning.title, /por encima/);
  assert.match(warning.basis, /5 obra/);

  // Un desvío pequeño no molesta: por debajo del umbral no se dice nada.
  const small = summarize([closed(1), closed(2), closed(1)]);
  assert.ok(!buildRecommendations(small, baseContext).some((entry) => entry.id === "desvio-costo-real"));
});

test("la desviación entre lo fabricado y lo cotizado se señala aparte del costo", () => {
  const closed = (piecesDeviationPct: number) => ({
    kind: "obra_cerrada",
    payload: { costDeviationPct: 0, realMarginPct: 30, piecesDeviationPct },
    createdAt: 1_780_000_000_000,
  });
  const stats = summarize([closed(8), closed(11), closed(9), closed(10)]);
  const warning = buildRecommendations(stats, baseContext).find((entry) => entry.id === "desvio-piezas-fabricadas");
  assert.ok(warning);
  assert.match(warning.title, /más/);
  assert.equal(warning.suggestion, undefined);
  // Y el de costo no aparece, porque ahí no hay desvío.
  assert.ok(!buildRecommendations(stats, baseContext).some((entry) => entry.id === "desvio-costo-real"));
});

test("las plantillas son configuraciones repetidas, con la medida representativa", () => {
  const stats = summarize([
    saveEvent({ typology: "Corrediza", systemName: "CORREDERA 60MM", glassName: "Laminado 6+6", widthMm: 1500, heightMm: 1200 }),
    saveEvent({ typology: "Corrediza", systemName: "CORREDERA 60MM", glassName: "Laminado 6+6", widthMm: 1600, heightMm: 1200 }),
    saveEvent({ typology: "Corrediza", systemName: "CORREDERA 60MM", glassName: "Laminado 6+6", widthMm: 9000, heightMm: 1200 }),
    saveEvent({ typology: "Fijo", systemName: "CORREDERA 60MM", widthMm: 600, heightMm: 600 }),
  ]);
  const templates = buildTemplates(stats);
  assert.equal(templates.length, 1, "una configuración usada una sola vez no es una plantilla");
  assert.equal(templates[0].typology, "Corrediza");
  assert.equal(templates[0].timesUsed, 3);
  // La mediana y no la última ni el promedio: la de 9 m no debe definir la plantilla.
  assert.equal(templates[0].widthMm, 1600);
});

test("las estadísticas resumen el histórico sin perder la ventana de tiempo", () => {
  const stats = summarize([
    saveEvent({ typology: "Corrediza", editSeconds: 300, dimensionEdits: 2 }, 1_000_000),
    saveEvent({ typology: "Corrediza", editSeconds: 600 }, 2_000_000),
    { kind: "componente_duplicado", payload: { typology: "Corrediza" }, createdAt: 3_000_000 },
  ]);
  assert.equal(stats.sampleSize, 2, "solo los componentes guardados forman la muestra");
  assert.equal(stats.totalEvents, 3);
  assert.equal(stats.duplicates, 1);
  assert.equal(stats.editSeconds.median, 600);
  assert.equal(stats.since, new Date(1_000_000).toISOString());
});
