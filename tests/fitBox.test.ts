import { strict as assert } from "node:assert";
import test from "node:test";
import { fitBox, FIT_PAD } from "../components/editor/fitBox";

// El lienzo real medido en la aplicación corriendo a 1366x768, con el panel de configuración,
// la paleta de herramientas y el panel de cotización en su sitio. No es un número inventado:
// es lo que devuelve getBoundingClientRect sobre .panZoomViewport.
const LIENZO_1366 = { w: 333, h: 466 };
// Proporción de la ventana de referencia con la que se abre el editor.
const AR = 1800 / 1400;

test("el dibujo ocupa el ancho del lienzo menos el hueco de las cotas", () => {
  const fit = fitBox(LIENZO_1366.w, LIENZO_1366.h, AR);
  assert.ok(fit, "tiene que caber en un lienzo de 333x466");
  assert.equal(Math.round(fit.width), LIENZO_1366.w - FIT_PAD.left - FIT_PAD.right);
  // Y no se deforma: la proporción que sale es la que entró.
  assert.ok(Math.abs(fit.width / fit.height - AR) < 1e-9);
});

test("el hueco reservado deja al dibujo mas de la mitad del lienzo", () => {
  // El reparto simétrico anterior (76 px por lado) se llevaba 152 de 333, un 46 % del ancho.
  const antes = LIENZO_1366.w - 76 * 2;
  const ahora = fitBox(LIENZO_1366.w, LIENZO_1366.h, AR)!.width;
  assert.ok(ahora > antes, `el dibujo tiene que crecer: antes ${antes}, ahora ${ahora}`);
  assert.ok(ahora / LIENZO_1366.w > 0.5, "el hueco no puede llevarse mas de la mitad del lienzo");
});

test("manda el alto cuando el lienzo es mas ancho que alto para esa proporcion", () => {
  const fit = fitBox(1200, 300, AR)!;
  assert.equal(Math.round(fit.height), 300 - FIT_PAD.top - FIT_PAD.bottom);
  assert.ok(fit.width < 1200 - FIT_PAD.left - FIT_PAD.right, "no puede pasarse del ancho disponible");
});

test("sin lienzo que medir no se fija ningun tamano", () => {
  assert.equal(fitBox(60, 400, AR), null);
  assert.equal(fitBox(400, 60, AR), null);
  assert.equal(fitBox(400, 400, 0), null);
  assert.equal(fitBox(400, 400, Number.NaN), null);
});

test("cada lado reserva solo lo que de verdad ocupa algo", () => {
  // La cota vertical vive a la izquierda; a la derecha no hay nada que esquivar.
  assert.ok(FIT_PAD.left > FIT_PAD.right * 2, "la cota vertical vive a la izquierda");
  // Abajo van la cadena de cotas y la cota total; arriba solo los controles de zoom, que son
  // mas bajos. Si el hueco de arriba creciera hasta el de abajo, algo se estaria colando ahi.
  assert.ok(FIT_PAD.bottom > FIT_PAD.top, "abajo van dos cotas, arriba solo los controles");
  assert.ok(FIT_PAD.top >= 34 + 10, "los controles miden 24 px a 10 px del borde: tienen que caber");
});
