import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";
import { elevationBands, elevationPercents, BEAD_DRAW_SHARE } from "../lib/elevation";
import { glassSizeMm } from "../data/glazing";
import { catalog } from "../data/catalog";

// catalog va por marca; aqui interesan TODOS los sistemas, sea de quien sea.
const SISTEMAS = Object.values(catalog).flat();

const W = 900;
const H = 1400;

test("el vidrio del dibujo es EL MISMO que el que se compra", () => {
  // Si estos dos numeros se separan, el dibujo empieza a mentir sobre lo que se pide al proveedor.
  for (const sys of SISTEMAS) {
    for (const enMarco of [true, false]) {
      const b = elevationBands(W, H, sys.name, enMarco);
      const g = glassSizeMm(W, H, sys.name, enMarco);
      assert.equal(b.glassWMm, g.wMm, sys.name);
      assert.equal(b.glassHMm, g.hMm, sys.name);
      assert.equal(b.glassCalibrated, g.calibrated, sys.name);
    }
  }
});

test("el perfil es exactamente el complemento del vidrio", () => {
  for (const sys of SISTEMAS) {
    const b = elevationBands(W, H, sys.name, false);
    // hoja = vidrio + perfil a los dos lados. No hay hueco sin asignar ni franja de sobra.
    assert.ok(Math.abs(b.glassWMm + b.profileWMm * 2 - W) < 1e-9, sys.name);
    assert.ok(Math.abs(b.glassHMm + b.profileHMm * 2 - H) < 1e-9, sys.name);
  }
});

test("el junquillo cabe dentro del perfil y va marcado como convencion de dibujo", () => {
  const b = elevationBands(W, H, SISTEMAS[0].name, false);
  assert.ok(b.beadWMm < b.profileWMm, "el junquillo no puede ser mas ancho que el perfil que lo aloja");
  assert.equal(b.beadWMm, b.profileWMm * BEAD_DRAW_SHARE);
  // Esta bandera existe para que nadie tome estos milimetros por una medida de fabricacion.
  assert.equal(b.beadIsDrawingConvention, true);
});

test("una hoja mas pequena que su propio descuento no produce franjas negativas", () => {
  const b = elevationBands(40, 40, SISTEMAS[0].name, false);
  assert.ok(b.profileWMm >= 0 && b.profileHMm >= 0);
  assert.ok(b.glassWMm >= 0 && b.glassHMm >= 0);
  assert.ok(b.beadWMm >= 0 && b.beadHMm >= 0);
});

test("los porcentajes que consume el dibujo suman el 100 % de la hoja", () => {
  const b = elevationBands(W, H, SISTEMAS[0].name, false);
  const p = elevationPercents(b, W, H);
  const vidrioX = 100 - p.profileX * 2;
  assert.ok(Math.abs(vidrioX - (b.glassWMm / W) * 100) < 1e-9);
  assert.ok(p.beadX < p.profileX);
});

test("el junquillo del dibujo NO entra en ningun calculo de fabricacion", () => {
  // El descuento real del junquillo vive en data/glazing.ts (beadFor) y es el que usa la lista de
  // corte. Esta es la garantia de que la proporcion de dibujo no se cuela ahi.
  const fuente = readFileSync("lib/calc.ts", "utf8");
  assert.ok(!fuente.includes("BEAD_DRAW_SHARE"), "lib/calc.ts no puede usar la proporcion de dibujo");
  assert.ok(!fuente.includes("elevationBands"), "lib/calc.ts no puede usar el reparto de dibujo");
});
