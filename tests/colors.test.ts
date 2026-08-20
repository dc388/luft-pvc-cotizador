import { strict as assert } from "node:assert";
import test from "node:test";
import { aluplastColors, colors } from "../data/colors";

// Los codigos que la lista de precios de 2022 dejaba sin nombre descriptivo. "negro", "azul",
// "mar" y "rojo" no entran aqui: esos SI son nombres, aunque coincidan con su codigo.
const ANTES_SIN_NOMBRE = ["br", "bd", "nb", "go", "sh", "soa", "soc", "tom", "jb"];

test("los codigos que estaban sin nombre ya tienen el del catalogo de folios 2025", () => {
  // A un arquitecto "BD" no le dice nada; "Brown Decor" si.
  for (const code of ANTES_SIN_NOMBRE) {
    const c = aluplastColors.find((x) => x.code === code);
    assert.ok(c, `falta el folio ${code}`);
    assert.notEqual(c!.name.toLowerCase(), code, `${code} sigue llamandose como su codigo`);
    assert.ok(c!.name.length > code.length + 1, `${code}: "${c!.name}" no es un nombre`);
    assert.ok(c!.renolit, `${code} tiene nombre pero no referencia Renolit`);
  }
});

test("solo queda un codigo sin identificar, y lo dice", () => {
  const sinRef = aluplastColors.filter((c) => !c.renolit && c.code !== "bl");
  // Los que quedan sin referencia son los que no aparecen en la documentacion de folios.
  assert.ok(sinRef.every((c) => (c.note ?? "").length > 0), "un folio sin referencia tiene que explicar por que");
  const dc = aluplastColors.find((c) => c.code === "dc")!;
  assert.equal(dc.name, "DC", "dc sigue sin nombre porque no aparece en ninguno de los dos documentos");
  assert.match(dc.note ?? "", /aluplastmex/i, "y tiene que decir que falta confirmarlo");
});

test("un folio con referencia Renolit trae sus dos codigos de pedido", () => {
  // El selector de cara de la ficha elige entre uno cara y dos caras: si hay referencia pero
  // falta un codigo, ese folio no se puede pedir para una de las dos configuraciones.
  for (const c of aluplastColors) {
    if (!c.renolit) continue;
    assert.ok(c.codeOneFace, `${c.code} tiene Renolit pero no codigo de una cara`);
    assert.ok(c.codeTwoFaces, `${c.code} tiene Renolit pero no codigo de dos caras`);
    assert.match(c.renolit, /^\d{3}-\d{4}$/, `${c.code}: referencia Renolit con formato raro`);
  }
});

test("los codigos de pedido no se repiten entre folios", () => {
  const usados = new Map<string, string>();
  for (const c of aluplastColors) {
    for (const cod of [c.codeOneFace, c.codeTwoFaces]) {
      if (!cod) continue;
      assert.ok(!usados.has(cod), `el codigo ${cod} lo usan ${usados.get(cod)} y ${c.code}`);
      usados.set(cod, c.code);
    }
  }
});

test("todo folio sin dato de precio propio lo dice", () => {
  // Mahagoni entro por el catalogo de folios, que no lleva precios. Su factor es prestado, y eso
  // tiene que estar escrito donde alguien lo pueda leer antes de fiarse del numero.
  const ma = aluplastColors.find((c) => c.code === "ma");
  assert.ok(ma, "Mahagoni tiene que estar: viene en el catalogo 2025 y en la ficha tecnica");
  assert.match(ma!.note ?? "", /no un dato de precio propio/i);
});

test("el blanco sigue siendo la base de precio", () => {
  assert.equal(aluplastColors.find((c) => c.code === "bl")!.factor, 1.0);
  for (const c of aluplastColors) assert.ok(c.factor >= 1.0, `${c.code} no puede costar menos que el blanco`);
});

test("cada folio tiene un HEX valido y unico por nombre", () => {
  const nombres = new Set<string>();
  for (const c of aluplastColors) {
    assert.match(c.hex, /^#[0-9A-Fa-f]{6}$/, `${c.code}: HEX invalido`);
    assert.ok(!nombres.has(c.name), `nombre repetido: ${c.name}`);
    nombres.add(c.name);
  }
});

test("Deceuninck sigue con su propio catalogo, sin contaminarse", () => {
  assert.ok(colors.Deceuninck.length > 0);
  for (const c of colors.Deceuninck) {
    assert.ok(!(c as { renolit?: string }).renolit, "los folios Renolit son de la ficha de Aluplast");
  }
});
