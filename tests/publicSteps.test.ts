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

test("entre Vidrio y Resumen hay una sola pantalla", () => {
  // Fueron dos etapas (instalación y precio), se fusionaron en una, y después el precio salió del
  // recorrido. Lo que se protege es que no vuelva a haber dos: una sola pantalla entre Vidrio y
  // Resumen, con la instalación como única decisión.
  assert.equal(S.CONFIRM, S.GLASS + 1);
  assert.equal(S.SUMMARY, S.CONFIRM + 1, "no debe quedar una etapa intermedia sobrante");
  assert.match(publicStepName(S.CONFIRM), /instalaci[oó]n/i);
});

test("ninguna etapa del recorrido se llama por el precio", () => {
  // El cliente no ve importes mientras configura: el precio aparece solo en el documento
  // definitivo. Una etapa llamada "Precio" o "Total" anunciaría lo contrario desde el indicador
  // de progreso, antes incluso de abrir la pantalla.
  for (const name of PUBLIC_STEPS) {
    assert.doesNotMatch(name, /precio|total|costo|pago|anticipo/i, `“${name}” anuncia un importe que el cliente no verá aquí`);
  }
});

test("el estilo va inmediatamente después del producto: no hay etapa de línea", () => {
  // Aluplast es la única perfilería, así que elegirla no era una decisión real. Si vuelve a
  // aparecer una etapa entre Producto y Estilo, el cliente vuelve a pagar un clic por nada.
  assert.equal(S.STYLE, S.PRODUCT + 1);
  for (const name of PUBLIC_STEPS) {
    assert.doesNotMatch(name, /l[íi]nea|marca|aluplast/i, `“${name}” no debe ser una etapa: la marca es información, no una elección`);
  }
});

test("publicStepName nunca deja al asesor sin etapa", () => {
  assert.equal(publicStepName(-1), PUBLIC_STEPS[S.PRODUCT]);
  assert.equal(publicStepName(999), PUBLIC_STEPS[S.PRODUCT]);
  assert.equal(publicStepName(S.PROCESS), "Proceso");
});
