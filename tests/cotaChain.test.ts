import { strict as assert } from "node:assert";
import test from "node:test";
import { chain, cotaChains } from "../components/editor/cotaChain";
import { typologyDefs } from "../data/typologies";
import { flattenToRects } from "../lib/tree";

const W = 1800;
const H = 1400;

test("la cadena suma la medida total en TODAS las tipologias", () => {
  for (const t of typologyDefs) {
    const tree = t.build();
    const { xs, ys } = cotaChains(tree, W, H);
    const sumX = xs.reduce((s, seg) => s + seg.len, 0);
    const sumY = ys.reduce((s, seg) => s + seg.len, 0);
    // Esto es lo que hace que una cadena de cotas sirva para algo: si no cierra, el reparto
    // esta mal. Con las medidas de fabricacion (que se solapan en el traslape) NO cerraria.
    assert.ok(Math.abs(sumX - W) < 0.5, `${t.name}: los anchos suman ${sumX}, no ${W}`);
    assert.ok(Math.abs(sumY - H) < 0.5, `${t.name}: los altos suman ${sumY}, no ${H}`);
  }
});

test("la cadena no deja huecos ni se pisa: cada tramo arranca donde acaba el anterior", () => {
  for (const t of typologyDefs) {
    const { xs, ys } = cotaChains(t.build(), W, H);
    for (const ejes of [xs, ys]) {
      ejes.forEach((seg, i) => {
        if (i === 0) assert.equal(seg.at, 0, `${t.name}: el primer tramo tiene que arrancar en 0`);
        else assert.ok(Math.abs(seg.at - (ejes[i - 1].at + ejes[i - 1].len)) < 0.5, `${t.name}: hueco o solape en el tramo ${i}`);
        assert.ok(seg.len > 0, `${t.name}: un tramo de cota no puede medir 0`);
      });
    }
  }
});

test("cada division real de la composicion tiene su tramo", () => {
  // Corrediza de 3 hojas: tres tramos de ancho, uno solo de alto.
  const tres = typologyDefs.find((t) => t.id === "corr-3")!;
  const { xs, ys } = cotaChains(tres.build(), W, H);
  assert.equal(xs.length, 3);
  assert.equal(ys.length, 1);
  // Y coinciden con las hojas de verdad, no con una idea de como deberian repartirse.
  const rects = [...flattenToRects(tres.build(), W, H)].sort((a, b) => a.x - b.x);
  xs.forEach((seg, i) => assert.ok(Math.abs(seg.len - rects[i].w) < 0.5));
});

test("un solo panel da un solo tramo, y ahi la cadena no se dibuja", () => {
  const fijo = typologyDefs.find((t) => t.id === "fijo-1")!;
  const { xs, ys } = cotaChains(fijo.build(), W, H);
  assert.equal(xs.length, 1);
  assert.equal(ys.length, 1);
});

test("dos bordes a menos de medio milimetro son el mismo borde", () => {
  // Los repartos salen de fracciones: 1800/3 tres veces no cae exacto.
  const c = chain([0, 600, 600.0000001, 1200, 1800], 1800);
  assert.equal(c.length, 3);
  assert.deepEqual(c.map((s) => Math.round(s.len)), [600, 600, 600]);
});

test("un borde fuera del hueco no entra en la cadena", () => {
  // Defensa: si alguna vez llega un rectangulo mal calculado, la cadena no puede pasarse del
  // total ni empezar en negativo, porque entonces mentiria en vez de avisar.
  const c = chain([-50, 900, 2400], 1800);
  assert.equal(c.reduce((s, x) => s + x.len, 0), 1800);
  assert.equal(c[0].at, 0);
});
