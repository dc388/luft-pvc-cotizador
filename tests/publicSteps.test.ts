import assert from "node:assert/strict";
import test from "node:test";
import { PUBLIC_STEPS, S, publicStepName } from "@/lib/publicSteps";

// El índice de pasos se desincronizó una vez: había dos arreglos de etapas y varios números
// mágicos (`step >= 9`, `step === 11`) repartidos entre la interfaz y el asesor. Estas pruebas
// hacen fallar el build si vuelven a divergir, en vez de dejar que el desfase se note por una
// pantalla vacía o una ayuda que habla de otra etapa.

test("cada nombre de etapa tiene exactamente un índice y viceversa", () => {
  const indices = Object.values(S);
  assert.equal(indices.length, PUBLIC_STEPS.length, "sobran o faltan índices frente a los nombres");
  assert.equal(new Set(indices).size, indices.length, "dos etapas comparten el mismo índice");
  for (const index of indices) {
    assert.ok(PUBLIC_STEPS[index], `el índice ${index} no tiene nombre de etapa`);
  }
});

test("los índices son contiguos desde PRODUCT hasta DONE", () => {
  // Un hueco sería el 'salto fantasma': una pantalla sin contenido que el cliente igual recorre.
  const ordered = Object.values(S).slice().sort((a, b) => a - b);
  assert.equal(ordered[0], S.PRODUCT);
  assert.equal(ordered.at(-1), S.DONE);
  assert.equal(S.DONE, PUBLIC_STEPS.length - 1, "DONE debe ser la última etapa");
  ordered.forEach((value, position) => assert.equal(value, position, "los índices deben ser contiguos"));
});

test("instalación y precio son una sola etapa", () => {
  // El objetivo de la fusión: una pantalla, no dos, entre Vidrio y Resumen.
  assert.equal(S.CONFIRM, S.GLASS + 1);
  assert.equal(S.SUMMARY, S.CONFIRM + 1, "no debe quedar una etapa intermedia sobrante");
  assert.match(publicStepName(S.CONFIRM), /instalaci[oó]n/i);
  assert.match(publicStepName(S.CONFIRM), /precio/i);
});

test("ninguna etapa se llama solo Instalación o solo Precio", () => {
  // Si reaparece una de las dos etapas antiguas, la fusión se deshizo.
  for (const name of PUBLIC_STEPS) {
    assert.notEqual(name, "Instalación");
    assert.notEqual(name, "Precio");
  }
});

test("publicStepName nunca deja al asesor sin etapa", () => {
  assert.equal(publicStepName(-1), PUBLIC_STEPS[S.PRODUCT]);
  assert.equal(publicStepName(999), PUBLIC_STEPS[S.PRODUCT]);
  assert.equal(publicStepName(S.PROCESS), "Proceso");
});
