import assert from "node:assert/strict";
import test from "node:test";
import { emptyRequester, formatAddress, mergeRequester, normalizeRequester, requesterIssues } from "@/lib/requester";

const NOW = "2026-08-12T17:00:00.000Z";

test("un proyecto puede empezar con el nombre del solicitante y nada más", () => {
  const requester = mergeRequester(emptyRequester(NOW), { fullName: "Ana Ramírez" }, NOW);
  // Ni RFC, ni persona de contacto, ni direcciones alternas: §4 prohíbe exigirlos para crear.
  assert.deepEqual(requesterIssues(requester), []);
});

test("el teléfono y el correo se revisan solo si se escribieron", () => {
  assert.deepEqual(requesterIssues(mergeRequester(emptyRequester(NOW), { phone: "" }, NOW)), []);

  const badPhone = requesterIssues(mergeRequester(emptyRequester(NOW), { phone: "993 22" }, NOW));
  assert.equal(badPhone.length, 1);
  assert.equal(badPhone[0].field, "phone");

  // Un teléfono de 10 dígitos escrito con separadores es válido: es como la gente lo escribe.
  assert.deepEqual(requesterIssues(mergeRequester(emptyRequester(NOW), { phone: "+52 (993) 221-1158" }, NOW)), []);

  const badEmail = requesterIssues(mergeRequester(emptyRequester(NOW), { email: "ana@" }, NOW));
  assert.equal(badEmail.length, 1);
  assert.equal(badEmail[0].field, "email");
  assert.deepEqual(requesterIssues(mergeRequester(emptyRequester(NOW), { email: "ana@fabela.mx" }, NOW)), []);
});

test("el código postal se revisa en las tres direcciones", () => {
  const requester = mergeRequester(
    emptyRequester(NOW),
    {
      address: { street: "", city: "", state: "", postalCode: "500", country: "" },
      billingAddress: { street: "Otra", city: "", state: "", postalCode: "abcde", country: "" },
    },
    NOW
  );
  const issues = requesterIssues(requester);
  assert.equal(issues.length, 2);
  assert.ok(issues.every((issue) => issue.field === "address"));
  assert.ok(issues.some((issue) => issue.message.includes("principal")));
  assert.ok(issues.some((issue) => issue.message.includes("facturación")));
});

test('una dirección alterna vacía se guarda como "la misma que la principal", no como vacía', () => {
  // `null` y una dirección con todo en blanco significan cosas distintas, y esa diferencia tiene que
  // sobrevivir al guardado y a la exportación.
  const blank = normalizeRequester({ billingAddress: { street: "", city: "", state: "", postalCode: "", country: "" } }, { now: NOW });
  assert.equal(blank.billingAddress, null);

  const real = normalizeRequester({ billingAddress: { street: "Calle 1", city: "", state: "", postalCode: "", country: "" } }, { now: NOW });
  assert.equal(real.billingAddress?.street, "Calle 1");
});

test("los proyectos guardados antes de que existiera la ficha recuperan su cliente", () => {
  // Su cliente vivía en la columna `projects.client`; la ficha se completa al leer.
  const migrated = normalizeRequester({}, { now: NOW, fallbackName: "Juan Pérez" });
  assert.equal(migrated.fullName, "Juan Pérez");
  // Y si la ficha ya trae nombre, el de la columna no lo pisa.
  const own = normalizeRequester({ fullName: "Ana Ramírez" }, { now: NOW, fallbackName: "Juan Pérez" });
  assert.equal(own.fullName, "Ana Ramírez");
});

test("una ficha ilegible se lee como ficha vacía en vez de propagar basura", () => {
  for (const bad of [null, undefined, 42, "texto", [], { address: 7, installationAddress: "no" }]) {
    const requester = normalizeRequester(bad, { now: NOW });
    assert.equal(typeof requester.fullName, "string");
    assert.equal(typeof requester.address.street, "string");
    assert.equal(requester.installationAddress, null);
  }
});

test("editar la ficha no reescribe cuándo se registró al solicitante", () => {
  const original = { ...emptyRequester("2026-01-01T00:00:00.000Z") };
  const edited = mergeRequester(original, { fullName: "Ana" }, NOW);
  assert.equal(edited.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(edited.updatedAt, NOW);
});

test("la dirección de una línea omite lo que esté vacío", () => {
  assert.equal(
    formatAddress({ street: "Av. Isidro Fabela 120", city: "Toluca", state: "", postalCode: "50000", country: "" }),
    "Av. Isidro Fabela 120, Toluca, 50000"
  );
  assert.equal(formatAddress(null), "");
});
