import assert from "node:assert/strict";
import test from "node:test";
import { resolveSashHardware } from "@/lib/hardware";
import { createLeaf } from "@/lib/tree";
import type { PaneSpec, WingType } from "@/types/domain";

// El dibujo pintaba una tuerca fija abajo a la izquierda de toda hoja operable: no dependía del
// tipo de apertura, ni de la dirección, ni de la altura de manilla, así que dos hojas con
// configuraciones opuestas se veían idénticas. Estas pruebas fijan las convenciones escritas en
// lib/hardware.ts, que son justo lo que se puede discutir con el taller: si alguien cambia de
// opinión sobre qué lado nombra "Derecha", el build lo dice en vez de dejarlo pasar al plano.

function spec(wing: WingType, patch: Partial<PaneSpec> = {}): PaneSpec {
  return { ...createLeaf(wing).spec, ...patch };
}

test("una hoja fija no lleva manilla, ni bisagras, ni puntos de cierre", () => {
  for (const wing of ["fixed", "inactive", "sliding-fixed"] as WingType[]) {
    const hw = resolveSashHardware(wing, spec(wing), 2000);
    assert.equal(hw.operable, false, `${wing} no debería ser operable`);
    assert.equal(hw.handleEdge, null);
    assert.equal(hw.hingeEdge, null);
    assert.equal(hw.lockPoints, 0);
  }
});

test("en una corrediza la manilla va en el montante hacia el que corre la hoja", () => {
  const derecha = resolveSashHardware("sliding", spec("sliding", { direction: "Derecha" }), 2000);
  const izquierda = resolveSashHardware("sliding", spec("sliding", { direction: "Izquierda" }), 2000);
  assert.equal(derecha.handleEdge, "right");
  assert.equal(izquierda.handleEdge, "left");
  // Es lo que hace que las dos manillas de una corrediza de 2 hojas se encuentren al centro,
  // como en obra: la hoja izquierda corre a la derecha y la derecha corre a la izquierda.
  assert.equal(derecha.slideDir, "right");
  assert.equal(izquierda.slideDir, "left");
  assert.equal(derecha.hingeEdge, null, "una corrediza no tiene bisagras");
});

test("en una practicable la dirección nombra el lado de la manilla y las bisagras van enfrente", () => {
  const derecha = resolveSashHardware("casement-in", spec("casement-in", { direction: "Derecha" }), 2000);
  assert.equal(derecha.handleEdge, "right");
  assert.equal(derecha.hingeEdge, "left");
  const izquierda = resolveSashHardware("casement-in", spec("casement-in", { direction: "Izquierda" }), 2000);
  assert.equal(izquierda.handleEdge, "left");
  assert.equal(izquierda.hingeEdge, "right");
});

test("una dirección que no nombra un lado cae en derecha, no deja la hoja sin manilla", () => {
  // "Interior"/"Exterior" describen hacia dónde abre, y "N/A" es lo que traen los proyectos
  // guardados antes de que estas hojas tuvieran dirección.
  for (const direction of ["Interior", "Exterior", "N/A", ""]) {
    const hw = resolveSashHardware("tilt-turn", spec("tilt-turn", { direction }), 2000);
    assert.equal(hw.handleEdge, "right", `dirección ${direction || "(vacía)"}`);
    assert.equal(hw.hingeEdge, "left");
  }
});

test("el oscilobatiente se distingue del abatible en el símbolo, no solo en el nombre", () => {
  assert.equal(resolveSashHardware("casement-in", spec("casement-in"), 2000).symbol, "casement");
  assert.equal(resolveSashHardware("tilt-turn", spec("tilt-turn"), 2000).symbol, "tilt-turn");
});

test("proyectante y proyectante inferior son simétricos: la bisagra cambia de canto", () => {
  const project = resolveSashHardware("project", spec("project"), 1200);
  assert.deepEqual([project.hingeEdge, project.handleEdge], ["top", "bottom"]);
  const hopper = resolveSashHardware("hopper", spec("hopper"), 1200);
  assert.deepEqual([hopper.hingeEdge, hopper.handleEdge], ["bottom", "top"]);
});

test("la pivotante gira sobre dos puntos centrales, sin bisagra de canto", () => {
  const hw = resolveSashHardware("pivot", spec("pivot", { direction: "Derecha" }), 2000);
  assert.equal(hw.pivot, true);
  assert.equal(hw.hingeEdge, null);
  assert.equal(hw.symbol, "pivot");
});

test("la altura de manilla en mm se traduce a su posición sobre el canto", () => {
  const mitad = resolveSashHardware("casement-in", spec("casement-in", { handlePosition: 1000 }), 2000);
  assert.equal(mitad.handleOffset, 0.5);
  const alta = resolveSashHardware("casement-in", spec("casement-in", { handlePosition: 1600 }), 2000);
  assert.equal(alta.handleOffset, 0.8);
});

test("una altura fuera de rango se dibuja dentro de la hoja, sin perder el dato capturado", () => {
  // Se recorta solo el dibujo: la ficha sigue mostrando lo que el usuario escribió.
  const pasada = resolveSashHardware("casement-in", spec("casement-in", { handlePosition: 9000 }), 2000);
  assert.ok(pasada.handleOffset <= 0.92 && pasada.handleOffset > 0.5);
  const cero = resolveSashHardware("casement-in", spec("casement-in", { handlePosition: 0 }), 2000);
  assert.equal(cero.handleOffset, 0.5, "sin altura capturada, la manilla va a media hoja");
  const sinAlto = resolveSashHardware("casement-in", spec("casement-in", { handlePosition: 1000 }), 0);
  assert.equal(sinAlto.handleOffset, 0.5, "una hoja sin alto no debe producir NaN");
});

test("el tipo de manilla elegido cambia la pieza que se dibuja", () => {
  const kind = (handle: string) => resolveSashHardware("casement-in", spec("casement-in", { handle }), 2000).handleKind;
  assert.equal(kind("Sin manilla"), "none");
  assert.equal(kind("Harmony con tetones"), "lever");
  assert.equal(kind("Manillón doble"), "bar");
  assert.equal(kind("Cierre embutido"), "flush");
  assert.equal(kind("Manivela jalousie"), "crank");
});

test("los puntos de cierre salen del herraje configurado", () => {
  const points = (hardware: string) => resolveSashHardware("casement-in", spec("casement-in", { hardware }), 2000).lockPoints;
  assert.equal(points("Sin herraje"), 0);
  assert.equal(points("Roto · cierre multipunto"), 3);
  assert.equal(points("Roto Patio · osciloparalela"), 2);
});
