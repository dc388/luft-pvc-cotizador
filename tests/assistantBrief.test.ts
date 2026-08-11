import assert from "node:assert/strict";
import test from "node:test";
import {
  applyBriefPatch,
  briefAreaM2,
  briefSummary,
  nextBriefQuestion,
  parseBriefPatch,
  parseDimensions,
  type AssistantBrief,
} from "@/lib/assistantBrief";

// Criterios de aceptación del brief de LUFT Asesor (§103-104, §244-246, §268-269).
// Cada prueba corresponde a un fallo real observado o a un criterio explícito del documento.

function feed(brief: AssistantBrief, message: string): AssistantBrief {
  return applyBriefPatch(brief, parseBriefPatch(message));
}

test("normaliza unidades: 4.5 m, 450 cm y 4500 mm son la misma medida (§103)", () => {
  for (const input of ["4.5 m x 3 m", "450 cm x 300 cm", "4500 mm x 3000 mm"]) {
    const { patch } = parseDimensions(input);
    assert.equal(patch.widthMm, 4500, `ancho de "${input}"`);
    assert.equal(patch.heightMm, 3000, `alto de "${input}"`);
  }
});

test("infiere la unidad por orden de magnitud cuando no se escribe", () => {
  assert.deepEqual(parseDimensions("4.5 x 3").patch, { widthMm: 4500, heightMm: 3000 });
  assert.deepEqual(parseDimensions("450 x 300").patch, { widthMm: 4500, heightMm: 3000 });
  assert.deepEqual(parseDimensions("4500 x 3000").patch, { widthMm: 4500, heightMm: 3000 });
});

test("una sola unidad escrita se aplica a los dos números", () => {
  assert.deepEqual(parseDimensions("450 x 300 cm").patch, { widthMm: 4500, heightMm: 3000 });
});

test("las etiquetas ganan sobre la posición: '3 de alto y 4.5 de ancho' (§104)", () => {
  const { patch } = parseDimensions("tengo 3 metros de alto y 4.5 de ancho");
  assert.equal(patch.widthMm, 4500);
  assert.equal(patch.heightMm, 3000);
});

test("entiende lenguaje informal: 'cuatro y medio por tres'", () => {
  const { patch } = parseDimensions("el hueco es cuatro y medio por tres");
  assert.equal(patch.widthMm, 4500);
  assert.equal(patch.heightMm, 3000);
});

test("rechaza medidas absurdas en vez de aceptarlas (§133)", () => {
  const result = parseDimensions("mi ventana mide 450 metros de ancho");
  assert.equal(result.patch.widthMm, undefined, "no debe aceptar 450 m");
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0].message, /confirmarlo/);
});

test("agregar color NO borra las medidas — el fallo crítico del brief (§246)", () => {
  let brief: AssistantBrief = {};
  brief = feed(brief, "tengo un espacio de 4.5 metros de ancho por 3 m de alto");
  assert.equal(brief.widthMm, 4500);
  assert.equal(brief.heightMm, 3000);

  brief = feed(brief, "y que sea negro");
  assert.equal(brief.widthMm, 4500, "el ancho debe sobrevivir");
  assert.equal(brief.heightMm, 3000, "el alto debe sobrevivir");
  assert.equal(brief.colorWord, "negro");
});

test("la conversación completa acumula sin perder nada (§268)", () => {
  let brief: AssistantBrief = {};
  brief = feed(brief, "tengo un espacio de 4.5 de ancho por 3 de alto");
  brief = feed(brief, "da al jardín");
  brief = feed(brief, "quiero poder pasar");
  brief = feed(brief, "quiero abrir casi todo");
  brief = feed(brief, "negro");
  brief = feed(brief, "4 hojas");
  brief = feed(brief, "las dos de en medio que corran");

  assert.equal(brief.widthMm, 4500);
  assert.equal(brief.heightMm, 3000);
  assert.equal(brief.location, "jardín");
  assert.equal(brief.accessRequired, true);
  assert.equal(brief.openingGoal, "maximum");
  assert.equal(brief.colorWord, "negro");
  assert.equal(brief.leafCount, 4);
  assert.equal(brief.movingLeaves, "center");
  assert.equal(briefAreaM2(brief), 13.5);
});

test("una corrección cambia solo el campo corregido (§269)", () => {
  let brief: AssistantBrief = {};
  brief = feed(brief, "mide 4.5 x 3");
  brief = feed(brief, "perdón el ancho es 4.20");
  assert.equal(brief.widthMm, 4200, "el ancho debe actualizarse");
  assert.equal(brief.heightMm, 3000, "el alto NO debe cambiar");
});

test("la corrección conserva el resto del contexto acumulado", () => {
  let brief: AssistantBrief = {};
  brief = feed(brief, "4.5 x 3 al jardín, quiero pasar, que abra casi todo, negro, 4 hojas");
  brief = feed(brief, "perdón el ancho es 4.20");
  assert.equal(brief.widthMm, 4200);
  assert.equal(brief.heightMm, 3000);
  assert.equal(brief.location, "jardín");
  assert.equal(brief.accessRequired, true);
  assert.equal(brief.openingGoal, "maximum");
  assert.equal(brief.colorWord, "negro");
  assert.equal(brief.leafCount, 4);
});

test("entiende negaciones: 'no quiero negro' no fija negro (§124)", () => {
  const brief = feed({}, "no quiero negro");
  assert.equal(brief.colorWord, undefined);
});

test("una negación no descarta el color alternativo de la misma frase", () => {
  const brief = feed({}, "no quiero negro, mejor blanco");
  assert.equal(brief.colorWord, "blanco");
});

test("varias instrucciones en un mensaje se procesan todas (§107)", () => {
  const brief = feed({}, "cambia a negro, déjala en 4 hojas, que corran las dos del centro y súbele el ancho a 4.80");
  assert.equal(brief.colorWord, "negro");
  assert.equal(brief.leafCount, 4);
  assert.equal(brief.movingLeaves, "center");
  assert.equal(brief.widthMm, 4800);
});

test("distingue dato confirmado de dato inferido (§18-19)", () => {
  const soloJardin = feed({}, "el vano da al jardín");
  assert.equal(soloJardin.accessRequired, true);
  assert.equal(soloJardin.provenance?.accessRequired, "inferred", "deducir el paso desde 'jardín' es inferencia");

  const explicito = feed(soloJardin, "sí, necesito pasar por ahí");
  assert.equal(explicito.provenance?.accessRequired, "confirmed");
});

test("una inferencia posterior no pisa un dato ya confirmado (§168)", () => {
  let brief = feed({}, "solo será ventana, no necesito pasar");
  assert.equal(brief.accessRequired, false);
  assert.equal(brief.provenance?.accessRequired, "confirmed");
  brief = feed(brief, "da al jardín");
  assert.equal(brief.accessRequired, false, "la inferencia de 'jardín' no debe revertir lo confirmado");
});

test("acumula prioridades en vez de reemplazarlas", () => {
  let brief = feed({}, "quiero mucha luz");
  brief = feed(brief, "y que tenga poco perfil");
  assert.deepEqual(brief.priorities, ["view", "minimal_frame"]);
});

test("la siguiente pregunta es la de mayor valor, y no repite lo ya sabido (§192)", () => {
  assert.equal(nextBriefQuestion({})?.field, "dimensions");

  const conMedidas: AssistantBrief = { widthMm: 4500, heightMm: 3000 };
  assert.equal(nextBriefQuestion(conMedidas)?.field, "accessRequired", "con medidas, lo que falta es la función");

  const conAcceso: AssistantBrief = { ...conMedidas, accessRequired: true, provenance: { accessRequired: "confirmed" } };
  assert.equal(nextBriefQuestion(conAcceso)?.field, "openingGoal");

  const completo: AssistantBrief = { ...conAcceso, openingGoal: "maximum" };
  assert.equal(nextBriefQuestion(completo), null, "sin huecos críticos no debe inventar preguntas");
});

test("nunca vuelve a preguntar las medidas una vez dadas", () => {
  let brief: AssistantBrief = {};
  brief = feed(brief, "4.5 x 3");
  brief = feed(brief, "negro");
  brief = feed(brief, "4 hojas");
  const question = nextBriefQuestion(brief);
  assert.notEqual(question?.field, "dimensions");
  assert.notEqual(question?.field, "widthMm");
  assert.notEqual(question?.field, "heightMm");
});

test("el resumen refleja el estado y marca lo que sigue por confirmar (§145)", () => {
  let brief: AssistantBrief = {};
  brief = feed(brief, "4.5 x 3 y da al jardín");
  const lines = briefSummary(brief).join(" | ");
  assert.match(lines, /4\.50 × 3\.00 m/);
  assert.match(lines, /13\.5 m²/);
  assert.match(lines, /jardín/);
  assert.match(lines, /por confirmar/, "el paso inferido debe presentarse como suposición");
});
