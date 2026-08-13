import assert from "node:assert/strict";
import test from "node:test";
import {
  PROJECT_FILE_SCHEMA_VERSION,
  parseBackupFile,
  parseProjectFile,
  projectFileName,
  serializeBackup,
  serializeProject,
} from "@/lib/projectFile";
import { defaultComponentData } from "@/lib/componentDefaults";
import { emptyRequester } from "@/lib/requester";
import { walkLeaves } from "@/lib/tree";
import type { ComponentRecord, ProjectRecord } from "@/types/project";

// El archivo de proyecto es la única pieza donde un dato de origen desconocido entra al modelo, así
// que lo que se prueba aquí es sobre todo lo que NO debe pasar: perder campos al ir y volver, y
// aceptar contenido que rompa la aplicación.

const NOW = "2026-08-12T17:00:00.000Z";

function makeProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: "proj-1",
    name: "Casa Isidro Fabela",
    folio: "LP-2026-0007",
    origin: "platform",
    source: "interno",
    status: "quoted",
    requester: {
      ...emptyRequester(NOW),
      fullName: "Ana Ramírez",
      company: "Constructora Fabela",
      phone: "993 221 1158",
      alternatePhone: "5566778899",
      email: "ana@fabela.mx",
      taxId: "RAMA800101ABC",
      contactPerson: "Ing. Luis Soto",
      acquisitionChannel: "Recomendación",
      notes: "Prefiere folio nogal.",
      address: { street: "Av. Isidro Fabela 120", city: "Toluca", state: "Estado de México", postalCode: "50000", country: "México" },
      installationAddress: { street: "Obra lote 4", city: "Metepec", state: "Estado de México", postalCode: "52140", country: "México" },
      billingAddress: null,
    },
    currency: "MXN",
    pricingListId: "EXWORK Veracruz rev. ABR_22",
    notes: "Entrega en dos etapas.",
    estimatedDate: "2026-10-01",
    createdBy: "dc",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    importedAt: null,
    originalCreatedAt: null,
    archivedAt: null,
    deletedAt: null,
    duplicatedFromId: null,
    schemaVersion: 1,
    activeComponentId: "comp-1",
    client: "Ana Ramírez",
    components: [],
    ...overrides,
  };
}

function makeComponent(overrides: Partial<ComponentRecord> = {}): ComponentRecord {
  const data = defaultComponentData();
  return {
    id: "comp-1",
    projectId: "proj-1",
    position: 0,
    code: "001",
    designation: "V01",
    location: "Cocina",
    qty: 3,
    widthMm: 1500,
    heightMm: 1200,
    brand: "Aluplast",
    systemIndex: 0,
    colorIndex: 1,
    glassIndex: 7,
    typology: "Corrediza",
    configState: "ok",
    unitPrice: 8123,
    total: 24369,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    data: {
      ...data,
      margin: 42,
      discount: 5,
      installation: 1500,
      transport: 600,
      client: "Ana Ramírez",
      clientAddress: "Av. Isidro Fabela 120",
      clientPhone: "9932211158",
      clientEmail: "ana@fabela.mx",
      deliveryDate: "2026-09-15",
      barLengthMm: 6000,
      marco: { ...data.marco, profileCode: "MC-60", reinforcement: true, mosquitero: true },
    },
    ...overrides,
  };
}

test("un proyecto exportado y vuelto a importar conserva todo lo necesario para seguir editándolo", () => {
  const project = makeProject();
  const component = makeComponent();
  const file = serializeProject(project, [component], { exportedBy: "prueba", exportedAt: NOW });

  const parsed = parseProjectFile(JSON.stringify(file));
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.error);
  if (!parsed.ok) return;

  const meta = parsed.value.project;
  assert.equal(meta.name, project.name);
  assert.equal(meta.folio, project.folio);
  assert.equal(meta.status, project.status);
  assert.equal(meta.currency, project.currency);
  assert.equal(meta.pricingListId, project.pricingListId);
  assert.equal(meta.notes, project.notes);
  assert.equal(meta.estimatedDate, project.estimatedDate);
  assert.equal(meta.createdBy, project.createdBy);

  // La ficha del solicitante completa, campo por campo: es justo lo que §4 exige que sobreviva al
  // viaje de ida y vuelta.
  assert.deepEqual(meta.requester.fullName, project.requester.fullName);
  assert.deepEqual(meta.requester.company, project.requester.company);
  assert.deepEqual(meta.requester.phone, project.requester.phone);
  assert.deepEqual(meta.requester.alternatePhone, project.requester.alternatePhone);
  assert.deepEqual(meta.requester.email, project.requester.email);
  assert.deepEqual(meta.requester.taxId, project.requester.taxId);
  assert.deepEqual(meta.requester.contactPerson, project.requester.contactPerson);
  assert.deepEqual(meta.requester.acquisitionChannel, project.requester.acquisitionChannel);
  assert.deepEqual(meta.requester.notes, project.requester.notes);
  assert.deepEqual(meta.requester.address, project.requester.address);
  assert.deepEqual(meta.requester.installationAddress, project.requester.installationAddress);
  // `null` significa "la misma que la principal" y NO debe volverse una dirección vacía.
  assert.equal(meta.requester.billingAddress, null);

  const [restored] = parsed.value.components;
  assert.equal(restored.code, component.code);
  assert.equal(restored.designation, component.designation);
  assert.equal(restored.location, component.location);
  assert.equal(restored.qty, component.qty);
  assert.equal(restored.widthMm, component.widthMm);
  assert.equal(restored.heightMm, component.heightMm);
  assert.equal(restored.brand, component.brand);
  assert.equal(restored.systemIndex, component.systemIndex);
  assert.equal(restored.colorIndex, component.colorIndex);
  assert.equal(restored.glassIndex, component.glassIndex);
  assert.equal(restored.unitPrice, component.unitPrice);
  assert.equal(restored.total, component.total);
  assert.equal(restored.data.margin, 42);
  assert.equal(restored.data.discount, 5);
  assert.equal(restored.data.installation, 1500);
  assert.equal(restored.data.transport, 600);
  assert.equal(restored.data.barLengthMm, 6000);
  assert.equal(restored.data.deliveryDate, "2026-09-15");
  assert.equal(restored.data.marco.profileCode, "MC-60");
  assert.equal(restored.data.marco.reinforcement, true);
  assert.equal(restored.data.marco.mosquitero, true);
  // El dibujo 2D es el árbol de composición: mismo número de hojas y mismos tipos de apertura.
  assert.deepEqual(
    walkLeaves(restored.data.tree).map((leaf) => leaf.wing),
    walkLeaves(component.data.tree).map((leaf) => leaf.wing)
  );
});

test("la fecha de creación original sobrevive a exportar, importar y volver a exportar", () => {
  const project = makeProject({ createdAt: "2026-01-05T00:00:00.000Z" });
  const first = serializeProject(project, [makeComponent()], { exportedBy: "prueba", exportedAt: NOW });
  assert.equal(first.project.originalCreatedAt, "2026-01-05T00:00:00.000Z");

  const parsed = parseProjectFile(JSON.stringify(first));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;

  // Al importar, el proyecto nace hoy pero declara su creación original; al exportarlo de nuevo,
  // esa fecha sigue siendo la de enero y no se reescribe con la de la importación.
  const reimported = makeProject({
    createdAt: NOW,
    origin: "imported",
    importedAt: NOW,
    originalCreatedAt: parsed.value.project.originalCreatedAt,
  });
  const second = serializeProject(reimported, [makeComponent()], { exportedBy: "prueba", exportedAt: NOW });
  assert.equal(second.project.originalCreatedAt, "2026-01-05T00:00:00.000Z");
});

test("los identificadores de las hojas se regeneran al importar y no se repiten", () => {
  const component = makeComponent();
  const file = serializeProject(makeProject(), [component, { ...component, id: "comp-2" }], {
    exportedBy: "prueba",
    exportedAt: NOW,
  });
  const parsed = parseProjectFile(JSON.stringify(file));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;

  const ids = parsed.value.components.flatMap((entry) => walkLeaves(entry.data.tree).map((leaf) => leaf.id));
  assert.equal(new Set(ids).size, ids.length, "dos hojas con el mismo id rompen la selección del editor");
  // Y el id de la hoja seleccionada apunta a una hoja que existe de verdad en el árbol importado.
  for (const entry of parsed.value.components) {
    const leafIds = walkLeaves(entry.data.tree).map((leaf) => leaf.id);
    assert.ok(leafIds.includes(entry.data.selectedId));
  }
});

test("un archivo que no es un proyecto se rechaza con un mensaje legible, sin lanzar", () => {
  for (const bad of ["", "no soy json", "null", "[]", '{"kind":"otra.cosa","schemaVersion":1}', '{"kind":"luft.project"}']) {
    const parsed = parseProjectFile(bad);
    assert.equal(parsed.ok, false, `debería rechazar: ${bad}`);
    if (!parsed.ok) assert.ok(parsed.error.length > 10, "el mensaje tiene que explicar el problema");
  }
});

test("un archivo de una versión futura se rechaza diciendo que hay que actualizar", () => {
  const parsed = parseProjectFile(
    JSON.stringify({ kind: "luft.project", schemaVersion: PROJECT_FILE_SCHEMA_VERSION + 5, project: {}, components: [] })
  );
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.match(parsed.error, /más reciente|Actualiza/i);
});

test("no se confía en el contenido del archivo: valores imposibles caen a valores usables", () => {
  const hostile = {
    kind: "luft.project",
    schemaVersion: 1,
    exportedAt: "no es una fecha",
    project: {
      name: 12345,
      status: "etapa-inventada",
      origin: "vino-de-marte",
      currency: { $ne: null },
      requester: { fullName: { toString: "no" }, email: 42, address: "no es un objeto" },
      createdAt: "ayer por la tarde",
    },
    components: [
      {
        designation: "V01",
        qty: -5,
        widthMm: Number.POSITIVE_INFINITY,
        heightMm: "1200",
        brand: "MarcaQueNoExiste",
        systemIndex: 9e9,
        data: {
          margin: 1e6,
          discount: -40,
          glassIndex: "no",
          barLengthMm: 0,
          tree: { kind: "split", axis: "diagonal", ratios: [-1, 0], children: [{ kind: "leaf", wing: "teletransporte" }, { kind: "leaf" }] },
          marco: "tampoco es un objeto",
        },
      },
    ],
  };

  const parsed = parseProjectFile(JSON.stringify(hostile));
  assert.ok(parsed.ok, "un archivo con basura debe abrir corregido, no reventar");
  if (!parsed.ok) return;

  assert.equal(typeof parsed.value.project.name, "string");
  assert.equal(parsed.value.project.status, "draft", "una etapa inventada cae a la inicial");
  assert.equal(parsed.value.project.origin, "platform");
  assert.equal(parsed.value.project.currency, "MXN");
  assert.equal(parsed.value.project.requester.fullName, "");
  assert.equal(parsed.value.project.requester.email, "");
  // Una fecha ilegible no viaja como texto libre: la interfaz la pasa por new Date().
  assert.ok(Number.isFinite(Date.parse(parsed.value.project.createdAt)));

  const [component] = parsed.value.components;
  assert.equal(component.qty >= 1, true);
  assert.ok(Number.isFinite(component.widthMm) && component.widthMm > 0);
  assert.equal(component.heightMm, 1200, "un número escrito como texto se acepta convertido");
  assert.equal(component.brand, "Aluplast", "una marca desconocida dejaría el catálogo en undefined");
  assert.ok(component.systemIndex <= 200);
  assert.ok(component.data.margin <= 95 && component.data.margin >= 0);
  assert.equal(component.data.discount, 0);
  assert.ok(Number.isFinite(component.data.glassIndex));
  assert.ok(component.data.barLengthMm >= 1000);

  // El árbol: eje inválido cae a "col", las proporciones se normalizan a suma 1 y un tipo de apertura
  // inexistente cae a fijo.
  const tree = component.data.tree;
  assert.equal(tree.kind, "split");
  if (tree.kind === "split") {
    assert.equal(tree.axis, "col");
    const sum = tree.ratios.reduce((total, ratio) => total + ratio, 0);
    assert.ok(Math.abs(sum - 1) < 0.001, `las proporciones deben sumar 1, sumaron ${sum}`);
    assert.ok(tree.ratios.every((ratio) => ratio > 0));
  }
  assert.ok(walkLeaves(tree).every((leaf) => leaf.wing === "fixed"));
  assert.equal(typeof component.data.marco.sides.top.reinforcement, "boolean");
});

test("un árbol absurdamente profundo o enorme se recorta en vez de colgar la interfaz", () => {
  // Un árbol de 400 niveles: más allá del techo de profundidad, la rama se resuelve como hoja.
  let deep: unknown = { kind: "leaf", wing: "fixed" };
  for (let level = 0; level < 400; level++) {
    deep = { kind: "split", axis: "col", ratios: [0.5, 0.5], children: [deep, { kind: "leaf", wing: "fixed" }] };
  }
  const parsed = parseProjectFile(
    JSON.stringify({
      kind: "luft.project",
      schemaVersion: 1,
      project: { name: "profundo" },
      components: [{ designation: "V01", data: { tree: deep } }],
    })
  );
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  const leaves = walkLeaves(parsed.value.components[0].data.tree);
  assert.ok(leaves.length <= 400, `se importaron ${leaves.length} hojas`);
  assert.ok(leaves.length > 0);
});

test("un componente con la configuración ilegible no arrastra a los demás", () => {
  const good = serializeProject(makeProject(), [makeComponent()], { exportedBy: "prueba", exportedAt: NOW });
  // `data` como número: el lector no encuentra nada aprovechable y cae a la configuración por
  // omisión, así que el componente entra recuperable en vez de tumbar la importación completa. Lo
  // que se comprueba es que el bueno llega intacto y que el conteo cuadra.
  const mixed = { ...good, components: [...good.components, { designation: "roto", data: 7 }] };
  const parsed = parseProjectFile(JSON.stringify(mixed));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.value.components.length, 2);
  assert.equal(parsed.value.components[0].designation, "V01");
});

test("la copia de seguridad usa el mismo lector que un archivo suelto", () => {
  const file = serializeProject(makeProject(), [makeComponent()], { exportedBy: "prueba", exportedAt: NOW });
  const backup = serializeBackup([file, file], { exportedBy: "prueba", exportedAt: NOW });
  const parsed = parseBackupFile(JSON.stringify(backup));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.value.projects.length, 2);

  assert.equal(parseBackupFile(JSON.stringify({ kind: "luft.backup", schemaVersion: 1, projects: [] })).ok, false);
  assert.equal(parseBackupFile(JSON.stringify(file)).ok, false, "un proyecto suelto no es una copia de seguridad");
});

test("el nombre del archivo es seguro para el sistema de archivos y conserva el folio", () => {
  const name = projectFileName("LP-2026-0007", "Cotización WEB · Ana / Fabela");
  assert.match(name, /^LP-2026-0007_Cotizacion_WEB_Ana_Fabela\.luftproj$/);
  assert.equal(projectFileName("", ""), "proyecto.luftproj");
  assert.ok(!projectFileName("", "../../etc/passwd").includes("/"));
});
