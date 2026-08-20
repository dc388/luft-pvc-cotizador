import { strict as assert } from "node:assert";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { newId } from "../lib/uuid";

const RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Sustituye globalThis.crypto por otro durante la prueba y lo devuelve al salir. */
function conCrypto<T>(reemplazo: unknown, fn: () => T): T {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value: reemplazo, configurable: true, writable: true });
  try { return fn(); } finally {
    if (original) Object.defineProperty(globalThis, "crypto", original);
    else delete (globalThis as { crypto?: unknown }).crypto;
  }
}

test("con randomUUID disponible se usa el del entorno", () => {
  assert.match(newId(), RE);
});

test("sin randomUUID sigue dando un UUID v4 valido", () => {
  // Es el caso de abrir la aplicacion por la IP de la red: http://192.168.1.80:5173 no es un
  // origen seguro, alli crypto.randomUUID no existe y el editor se caia antes de dibujar nada.
  const id = conCrypto({ getRandomValues: (b: Uint8Array) => webcrypto.getRandomValues(b) }, () => newId());
  assert.match(id, RE, `no es un UUID v4: ${id}`);
});

test("no se repiten", () => {
  const fuera = { getRandomValues: (b: Uint8Array) => webcrypto.getRandomValues(b) };
  const ids = new Set(conCrypto(fuera, () => Array.from({ length: 5000 }, () => newId())));
  assert.equal(ids.size, 5000);
});

test("sin aleatoriedad criptografica falla en vez de emitir un identificador debil", () => {
  // Por aqui salen los tokens con los que se sirve una cotizacion definitiva. Caer a Math.random
  // dejaria ver la cotizacion de un cliente a cualquiera que adivinara el token, y en silencio.
  assert.throws(() => conCrypto({}, () => newId()), /aleatoriedad/i);
  assert.throws(() => conCrypto(undefined, () => newId()), /aleatoriedad/i);
});

test("los bits de version y variante son los que manda la norma", () => {
  const fuera = { getRandomValues: (b: Uint8Array) => b.fill(0xff) };
  const id = conCrypto(fuera, () => newId());
  // Con todo a 0xff, lo unico que puede no ser 'f' son los bits que se fijan a mano.
  assert.equal(id[14], "4", "la version tiene que ser 4");
  assert.ok(["8", "9", "a", "b"].includes(id[19]), "la variante tiene que ser RFC 4122");
  assert.match(id, RE);
});
