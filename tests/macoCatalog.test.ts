import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  CATALOG_TITLE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  isSearchField,
  revisionLabel,
  type HardwareRevision,
} from "@/lib/maco/catalog";
import { isPublicPath } from "@/lib/internalGate";

// Pruebas de la frontera: que la búsqueda interna esté protegida y que los precios de proveedor
// no puedan salir por ninguna superficie pública. Las consultas contra D1 se ejercitan en
// tests/macoImport.test.ts; aquí se verifica lo que ninguna consulta puede arreglar después.

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

/** Todos los archivos .ts/.tsx del proyecto, sin node_modules ni artefactos de compilación. */
function sourceFiles(directories: string[]): string[] {
  const skip = new Set(["node_modules", ".git", "dist", ".next", ".vinext", ".wrangler", "build", "output", "outputs", "tmp"]);
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) found.push(full);
    }
  };
  for (const directory of directories) {
    if (statSync(directory, { throwIfNoEntry: false })?.isDirectory()) walk(directory);
  }
  return found;
}

test("el título de la pantalla nombra a MACO como herraje y a Aluplast como sistema", () => {
  assert.equal(CATALOG_TITLE, "Herrajes MACO para sistemas Aluplast");
});

test("la etiqueta de la revisión ABR_22 dice histórica, fecha, moneda y condición", () => {
  const revision: HardwareRevision = {
    id: "src-1",
    supplier: "MACO",
    brand: "Aluplast",
    revision: "ABR_22",
    effectiveDate: "2022-05-01",
    currency: "EUR",
    terms: "EXWORK Veracruz/México",
    active: false,
    historical: true,
    fileName: "LOUDVENTURES_MEXpricelist22_2022_MACO.xlsx",
    fileHashShort: "615163283683",
    importedAt: "2026-08-13 00:00:00",
    itemCount: 637,
  };
  assert.equal(
    revisionLabel(revision),
    "Lista histórica ABR_22 · 1 de mayo de 2022 · EUR · EXWORK Veracruz/México"
  );
  // Activarla cambia la etiqueta, pero eso solo puede pasar por decisión humana.
  assert.match(revisionLabel({ ...revision, active: true }), /^Lista vigente ABR_22/);
});

test("valida el campo de búsqueda en vez de confiar en la query string", () => {
  for (const field of ["sku", "clave", "descripcion", "todo"]) assert.ok(isSearchField(field));
  for (const field of ["", "precio", "DROP TABLE", "unit_price"]) assert.equal(isSearchField(field), false);
});

test("toda consulta lleva límite con techo: nunca se carga el catálogo completo", () => {
  assert.ok(MAX_LIMIT <= 100, "el techo de resultados debe seguir siendo bajo");
  assert.ok(DEFAULT_LIMIT <= MAX_LIMIT);

  const source = readSource("lib/maco/catalog.ts");
  assert.match(source, /\.limit\(/, "searchHardware debe limitar los resultados");
  assert.match(source, /\.offset\(/, "searchHardware debe paginar");
  assert.match(source, /Math\.min\(.*MAX_LIMIT\)/, "el límite pedido debe recortarse a MAX_LIMIT");
});

// ---------------------------------------------------------------------------------------------
// Protección del endpoint interno
// ---------------------------------------------------------------------------------------------

test("el endpoint de herrajes NO es público", () => {
  // La lista blanca de lib/internalGate.ts es de lo público: cualquier ruta nueva queda protegida
  // por omisión. Esto verifica que /api/maco-hardware no se colara en ella.
  assert.equal(isPublicPath("/api/maco-hardware"), false);
  assert.equal(isPublicPath("/api/maco-hardware/"), false);
  assert.equal(isPublicPath("/api/maco-hardware?q=100528"), false);

  // Contraste: lo que sí es público sigue siéndolo.
  assert.equal(isPublicPath("/cotizar"), true);
  assert.equal(isPublicPath("/api/public-quote"), true);
});

test("el endpoint no se llama public-*, que es lo que lo dejaría abierto", () => {
  // La convención de nombre ES el contrato de lib/internalGate.ts: una ruta `public-*` pasa el
  // candado. Que este endpoint nunca adopte ese prefijo es la mitad de su protección.
  assert.equal(isPublicPath("/api/public-maco-hardware"), true, "el prefijo público sigue funcionando así");
  assert.ok(!"/api/maco-hardware".includes("public-"));
});

// ---------------------------------------------------------------------------------------------
// Confidencialidad: los precios MACO no salen por lo público
// ---------------------------------------------------------------------------------------------

test("lib/publicCatalog.ts no toca el catálogo de herrajes MACO", () => {
  const source = readSource("lib/publicCatalog.ts");
  assert.ok(!source.includes("maco"), "publicCatalog no debe mencionar maco");
  assert.ok(!source.includes("MACO"));
  assert.ok(!source.includes("supplierHardware"));
  assert.ok(!source.includes("supplierCatalogSources"));
});

test("ninguna superficie pública importa el catálogo o el esquema de herrajes MACO", () => {
  // Lo público es: el cotizador (/cotizar), sus endpoints `public-*` y la cotización del cliente.
  const publicSurfaces = [
    "app/cotizar",
    "app/cotizacion",
    "app/api/public-assistant",
    "app/api/public-quote",
    "components/cotizar",
    "lib/publicCatalog.ts",
    "lib/publicQuote.ts",
  ];
  const files = sourceFiles(publicSurfaces.filter((path) => statSync(path, { throwIfNoEntry: false })));
  const singles = publicSurfaces.filter((path) => statSync(path, { throwIfNoEntry: false })?.isFile());
  assert.ok(files.length + singles.length > 0, "no se encontró ninguna superficie pública que revisar");

  for (const file of [...files, ...singles]) {
    const source = readSource(file);
    assert.ok(
      !/from\s+["'][^"']*maco\/catalog["']/.test(source),
      `${file} importa el catálogo interno de herrajes MACO`
    );
    assert.ok(
      !/supplierHardwarePrices|supplierHardwareItems|supplierCatalogSources/.test(source),
      `${file} referencia las tablas de precios de proveedor`
    );
    assert.ok(!/maco-hardware/.test(source), `${file} llama al endpoint interno de herrajes`);
  }
});

test("el módulo de consulta es de servidor: no es un componente cliente", () => {
  const source = readSource("lib/maco/catalog.ts");
  assert.ok(!source.includes('"use client"'), "el módulo que consulta precios no puede ser de cliente");
  assert.match(source, /SOLO SERVIDOR/, "la restricción debe quedar dicha en el propio archivo");
});

test("la pantalla interna no trae precios incrustados: los pide por fetch", () => {
  const source = readSource("components/admin/HerrajesMaco.tsx");
  assert.match(source, /"use client"/);
  // Importa solo TIPOS, y de un módulo que no consulta nada.
  assert.match(source, /import type \{[^}]*\} from "@\/types\/maco"/);
  assert.ok(
    !/from "@\/lib\/maco\/catalog"/.test(source),
    "el componente cliente no debe importar el módulo que consulta la base"
  );
  assert.ok(!/from "@\/db/.test(source), "el componente cliente no debe importar el esquema");
  assert.match(source, /fetch\(`\/api\/maco-hardware/);
});

test("types/maco.ts no importa nada, para que nunca arrastre la consulta al cliente", () => {
  const source = readSource("types/maco.ts");
  assert.ok(!/^\s*import\s/m.test(source), "types/maco.ts debe seguir sin imports");
});

test("el asistente público no conoce el catálogo de herrajes del proveedor", () => {
  for (const file of ["lib/publicQuote.ts", "app/api/public-assistant/route.ts"]) {
    const source = readSource(file);
    assert.ok(!/MACO/.test(source), `${file} menciona MACO`);
    assert.ok(!/unit_price|unitPrice/.test(source), `${file} referencia precios de proveedor`);
  }
});
