import assert from "node:assert/strict";
import test from "node:test";
import { formatFolio, phoneKey } from "@/lib/quoteRepo";
import { INITIAL_QUOTE_STATUS, isQuoteStatus, QUOTE_STATUSES, quoteStatusLabel } from "@/lib/quoteStatus";
import { parseQuoteSnapshot } from "@/lib/quoteDocument";

// Las reglas del expediente que no dependen de la base de datos. Lo que sí la toca (insertar,
// reintentar el consecutivo, buscar) se verifica contra D1 en el recorrido del navegador.

test("el folio es consecutivo, con año y seis dígitos, y no se repite", () => {
  assert.equal(formatFolio(2026, 1), "LUFT-2026-000001");
  assert.equal(formatFolio(2026, 42), "LUFT-2026-000042");
  assert.equal(formatFolio(2026, 999999), "LUFT-2026-999999");
  // El consecutivo se reinicia por año, así que el mismo número en años distintos son folios
  // distintos: es el par (año, consecutivo) el que tiene que ser único, no el consecutivo solo.
  assert.notEqual(formatFolio(2026, 1), formatFolio(2027, 1));

  const folios = new Set(Array.from({ length: 500 }, (_, index) => formatFolio(2026, index + 1)));
  assert.equal(folios.size, 500, "500 consecutivos deben dar 500 folios distintos");
});

test("el mismo teléfono escrito de cinco maneras es un solo cliente", () => {
  const written = ["9932211158", "993 221 1158", "+52 993 221 1158", "(993) 221-1158", "52 9932211158"];
  const keys = new Set(written.map(phoneKey));
  assert.equal(keys.size, 1, `deberían coincidir: ${[...keys].join(", ")}`);
  assert.equal([...keys][0], "9932211158");
});

test("dos clientes distintos no se confunden por el formato", () => {
  assert.notEqual(phoneKey("9932211158"), phoneKey("9932211159"));
  // Un número incompleto no puede colapsar con otro: se queda tal cual y la ruta de envío lo
  // rechaza antes de llegar a la base (mínimo 10 dígitos).
  assert.equal(phoneKey("221115"), "221115");
});

test("la cotización nace en una etapa real del proceso", () => {
  assert.ok(isQuoteStatus(INITIAL_QUOTE_STATUS));
  assert.equal(quoteStatusLabel(INITIAL_QUOTE_STATUS), "Cotización generada");
  assert.equal(isQuoteStatus("etapa-inventada"), false);
  // Cada identificador tiene etiqueta: una etapa sin nombre saldría cruda en el panel interno.
  for (const status of QUOTE_STATUSES) {
    assert.notEqual(quoteStatusLabel(status), status, `${status} necesita etiqueta legible`);
    assert.doesNotMatch(status, /[A-Z\s]/, `${status} viaja en URL y base: sin mayúsculas ni espacios`);
  }
});

test("un snapshot corrupto da un documento incompleto, no una excepción", () => {
  // La página del documento es lo último que ve un cliente: si una fila vieja o dañada la
  // reventara, el cliente vería un error del servidor en vez de su cotización.
  assert.equal(parseQuoteSnapshot("no es json"), null);
  assert.equal(parseQuoteSnapshot("{}"), null, "sin renglones no hay documento que mostrar");

  const partial = parseQuoteSnapshot(JSON.stringify({ folio: "LUFT-2026-000007", items: [{ styleName: "Corrediza" }] }));
  assert.ok(partial);
  assert.equal(partial.folio, "LUFT-2026-000007");
  assert.equal(partial.items.length, 1);
  assert.equal(partial.items[0].quantity, 1, "una cantidad ausente vale 1, no NaN");
  assert.equal(partial.items[0].unitPrice, 0);
  assert.equal(partial.totals.total, 0);
  assert.equal(partial.customer.name, "");
});

test("el snapshot conserva los importes tal como se cotizaron", () => {
  // Es la única estructura del proyecto que guarda dinero de cara al cliente, y lo guarda
  // congelado: el documento de marzo no puede cambiar de precio en abril.
  const raw = JSON.stringify({
    folio: "LUFT-2026-000008",
    issuedAt: "2026-03-04T10:00:00.000Z",
    customer: { name: "Cliente de prueba", phone: "9932211158", city: "Villahermosa" },
    project: { name: "Casa", notes: "Dos recámaras" },
    items: [{ id: "LUFT-2026-000008-01", styleName: "Corrediza de 2 hojas", widthMm: 1800, heightMm: 1200, quantity: 2, unitPrice: 9000, lineTotal: 18000, wings: ["slide", "fixed"], extras: { instalacion: true } }],
    totals: { subtotal: 18000, total: 18000, estimated: false, depositPercentage: 70, deposit: 12600, remaining: 5400 },
  });
  const snapshot = parseQuoteSnapshot(raw);
  assert.ok(snapshot);
  assert.equal(snapshot.items[0].lineTotal, 18000);
  assert.equal(snapshot.totals.deposit, 12600);
  assert.equal(snapshot.totals.deposit + snapshot.totals.remaining, snapshot.totals.total, "el anticipo y el saldo deben sumar el total");
  assert.deepEqual(snapshot.items[0].wings, ["slide", "fixed"]);
});
