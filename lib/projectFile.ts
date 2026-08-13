import { wingDefs } from "@/data/wings";
import { BAR_LENGTH_MM } from "@/lib/calc";
import { defaultComponentData } from "@/lib/componentDefaults";
import { INITIAL_PROJECT_STATUS, isProjectOrigin, isProjectStatus } from "@/lib/projectStatus";
import { normalizeRequester } from "@/lib/requester";
import { defaultGlassSides, defaultMarco, defaultSides } from "@/lib/tree";
import type { FrameNode, GlassSide, GlassSides, Marco, PaneSpec, Side, Sides, WingType } from "@/types/domain";
import type {
  ComponentConfigState,
  ComponentData,
  ComponentRecord,
  ProjectOrigin,
  ProjectRecord,
  ProjectStatus,
  Requester,
} from "@/types/project";

/**
 * El archivo de proyecto: guardar un proyecto completo en disco y volver a abrirlo.
 *
 * Este módulo es la frontera entre lo que la aplicación cree y lo que un archivo dice. Todo lo que
 * entra por `parseProjectFile` es dato de origen desconocido -- puede venir de otra versión de la
 * plataforma, de un archivo editado a mano o de uno corrupto -- así que se valida campo por campo y
 * se construye un objeto nuevo. Nunca se hace `JSON.parse` y se asume la forma.
 *
 * Tres reglas que explican casi todas las decisiones de abajo:
 *
 *   1. NADA se ejecuta ni se interpreta. Solo se leen cadenas, números y booleanos, y las cadenas
 *      que eligen comportamiento (tipo de apertura, etapa, origen) se comparan contra la lista de
 *      valores válidos; una que no esté cae al valor por omisión en vez de propagarse.
 *   2. Todo campo desconocido se descarta y todo campo faltante toma su valor por omisión. Un
 *      archivo de una versión anterior abre; uno de una versión posterior abre con lo que entienda.
 *   3. Hay techos a lo que un archivo puede pedir (profundidad y número de hojas del árbol, número
 *      de componentes, longitud de cada texto). Un archivo no debe poder colgar la interfaz
 *      pidiéndole dibujar un millón de hojas.
 */

/** Versión del esquema del archivo. Se sube cuando cambia la FORMA de lo guardado, no cuando se
 *  agrega un campo opcional: agregar campos ya está cubierto por la regla 2. */
export const PROJECT_FILE_SCHEMA_VERSION = 1;
export const PROJECT_FILE_EXTENSION = "luftproj";
const PROJECT_FILE_KIND = "luft.project";
const BACKUP_FILE_KIND = "luft.backup";

// Techos. Generosos para cualquier proyecto real y suficientes para que un archivo hostil no pueda
// pedir un dibujo imposible.
const MAX_COMPONENTS = 500;
const MAX_TREE_DEPTH = 16;
const MAX_LEAVES = 400;
const MAX_TEXT = 2000;
const MAX_SHORT_TEXT = 200;
const MAX_BACKUP_PROJECTS = 2000;

const WING_TYPES = new Set<string>(wingDefs.map((w) => w.id));

export type ProjectFileComponent = {
  code: string;
  designation: string;
  location: string;
  qty: number;
  widthMm: number;
  heightMm: number;
  brand: string;
  systemIndex: number;
  colorIndex: number;
  glassIndex: number;
  typology: string;
  configState: ComponentConfigState;
  unitPrice: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  data: ComponentData;
};

export type ProjectFileMeta = {
  name: string;
  folio: string;
  origin: ProjectOrigin;
  status: ProjectStatus;
  requester: Requester;
  currency: string;
  pricingListId: string;
  notes: string;
  estimatedDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  originalCreatedAt: string | null;
};

export type ProjectFile = {
  kind: typeof PROJECT_FILE_KIND;
  schemaVersion: number;
  exportedAt: string;
  /** Identificador del build que exportó, para poder rastrear un archivo raro a una versión. */
  exportedBy: string;
  /** Id del proyecto en la plataforma que lo exportó. Sirve para detectar al importar que el
   *  archivo es de un proyecto que ya existe aquí y poder preguntar si se copia o se reemplaza. */
  sourceProjectId: string;
  project: ProjectFileMeta;
  components: ProjectFileComponent[];
};

export type BackupFile = {
  kind: typeof BACKUP_FILE_KIND;
  schemaVersion: number;
  exportedAt: string;
  exportedBy: string;
  projects: ProjectFile[];
};

// ---------- Lectores primitivos ----------

function readString(value: unknown, max = MAX_SHORT_TEXT, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function readBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Números: solo finitos, dentro de rango y redondeados si se piden enteros. NaN e Infinity son la
 *  vía más corta para que un archivo reviente un cálculo de costos o un `style` del dibujo. */
function readNumber(value: unknown, opts: { min: number; max: number; fallback: number; integer?: boolean }): number {
  const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(raw)) return opts.fallback;
  const clamped = Math.min(opts.max, Math.max(opts.min, raw));
  return opts.integer ? Math.round(clamped) : clamped;
}

/** Fechas ISO. Una fecha ilegible se cambia por el respaldo en vez de viajar como texto libre:
 *  toda la interfaz la pasa por `new Date(...).toLocaleString()`, que con basura muestra
 *  "Invalid Date". */
function readIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value) return fallback;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function readOptionalIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// ---------- Lectores del dominio ----------

function readSide(value: unknown): Side {
  const source = record(value);
  return { reinforcement: readBool(source.reinforcement), notes: readString(source.notes, MAX_TEXT) };
}

function readSides(value: unknown): Sides {
  const source = record(value);
  const base = defaultSides();
  return {
    top: source.top === undefined ? base.top : readSide(source.top),
    bottom: source.bottom === undefined ? base.bottom : readSide(source.bottom),
    left: source.left === undefined ? base.left : readSide(source.left),
    right: source.right === undefined ? base.right : readSide(source.right),
  };
}

function readGlassSide(value: unknown): GlassSide {
  const source = record(value);
  return {
    angulo1: readNumber(source.angulo1, { min: 0, max: 180, fallback: 45 }),
    angulo2: readNumber(source.angulo2, { min: 0, max: 180, fallback: 45 }),
    radio: readNumber(source.radio, { min: 0, max: 100_000, fallback: 0 }),
    arco: readNumber(source.arco, { min: 0, max: 100_000, fallback: 0 }),
    notes: readString(source.notes, MAX_TEXT),
  };
}

function readGlassSides(value: unknown): GlassSides {
  const source = record(value);
  const base = defaultGlassSides();
  return {
    top: source.top === undefined ? base.top : readGlassSide(source.top),
    bottom: source.bottom === undefined ? base.bottom : readGlassSide(source.bottom),
    left: source.left === undefined ? base.left : readGlassSide(source.left),
    right: source.right === undefined ? base.right : readGlassSide(source.right),
  };
}

function readPaneSpec(value: unknown): PaneSpec {
  const source = record(value);
  return {
    state: readString(source.state, MAX_SHORT_TEXT, "Fija"),
    opening: readString(source.opening, MAX_SHORT_TEXT, "Sin apertura"),
    direction: readString(source.direction, MAX_SHORT_TEXT, "N/A"),
    hardware: readString(source.hardware, MAX_SHORT_TEXT, "Sin herraje"),
    handle: readString(source.handle, MAX_SHORT_TEXT, "Sin manilla"),
    glass: readString(source.glass, MAX_SHORT_TEXT, "Heredar vidrio general"),
    notes: readString(source.notes, MAX_TEXT),
    mallorquina: readBool(source.mallorquina),
    sides: readSides(source.sides),
    glassSides: readGlassSides(source.glassSides),
    pocketType: readString(source.pocketType, MAX_SHORT_TEXT, "N/A"),
    useGancho: readBool(source.useGancho),
    useAdaptador: readBool(source.useAdaptador),
    handlePosition: readNumber(source.handlePosition, { min: 0, max: 20_000, fallback: 0, integer: true }),
    profileCode: readString(source.profileCode, MAX_SHORT_TEXT),
    railIndex: readNumber(source.railIndex, { min: 0, max: 8, fallback: 0, integer: true }),
  };
}

function readWing(value: unknown): WingType {
  return typeof value === "string" && WING_TYPES.has(value) ? (value as WingType) : "fixed";
}

/** Presupuesto compartido por todo el árbol de un componente: sin él, un archivo podría declarar
 *  cuatro mil hojas repartidas en ramas poco profundas y pasar el límite de profundidad. */
type TreeBudget = { leaves: number };

/**
 * Lee el árbol de composición, que es la parte más profunda y por tanto la más delicada del
 * archivo. Devuelve `null` cuando la rama no es reconocible, y quien llama la sustituye por una
 * hoja: un archivo con un nodo roto abre con esa parte simplificada en vez de no abrir.
 *
 * Los ids se regeneran y no se leen del archivo. Un id del archivo podría venir repetido, y dos
 * hojas con el mismo id rompen la selección y el recorrido del árbol -- un fallo que aparecería
 * mucho después de importar y sin relación aparente con el archivo.
 */
function readFrameNode(value: unknown, depth: number, budget: TreeBudget): FrameNode | null {
  const source = record(value);

  if (source.kind === "split" && Array.isArray(source.children) && depth < MAX_TREE_DEPTH) {
    const children = source.children
      .map((child) => readFrameNode(child, depth + 1, budget))
      .filter((child): child is FrameNode => child !== null);
    if (children.length === 0) return null;
    if (children.length === 1) return children[0];

    // Las proporciones tienen que sumar 1 y ser todas positivas: el dibujo las usa como
    // porcentajes y una negativa o un cero produce una hoja invisible o invertida.
    const rawRatios = Array.isArray(source.ratios) ? source.ratios : [];
    const ratios = children.map((_, index) =>
      readNumber(rawRatios[index], { min: 0.0001, max: 1, fallback: 1 / children.length })
    );
    const sum = ratios.reduce((total, ratio) => total + ratio, 0);
    return {
      kind: "split",
      id: crypto.randomUUID(),
      axis: source.axis === "row" ? "row" : "col",
      ratios: ratios.map((ratio) => ratio / sum),
      children,
    };
  }

  if (budget.leaves >= MAX_LEAVES) return null;
  budget.leaves += 1;
  return { kind: "leaf", id: crypto.randomUUID(), wing: readWing(source.wing), spec: readPaneSpec(source.spec) };
}

function readMarco(value: unknown): Marco {
  const source = record(value);
  const base = defaultMarco();
  return {
    profileCode: readString(source.profileCode, MAX_SHORT_TEXT),
    reinforcement: readBool(source.reinforcement),
    reinforcementCode: readString(source.reinforcementCode, MAX_SHORT_TEXT),
    mosquitero: readBool(source.mosquitero),
    mosquiteroCode: readString(source.mosquiteroCode, MAX_SHORT_TEXT),
    persiana: readBool(source.persiana),
    persianaCode: readString(source.persianaCode, MAX_SHORT_TEXT),
    sides: source.sides === undefined ? base.sides : readSides(source.sides),
  };
}

function readComponentData(value: unknown): ComponentData {
  const source = record(value);
  const base = defaultComponentData();
  const budget: TreeBudget = { leaves: 0 };
  const tree = readFrameNode(source.tree, 0, budget) ?? base.tree;
  return {
    rail: readNumber(source.rail, { min: 0, max: 8, fallback: base.rail, integer: true }),
    glassIndex: readNumber(source.glassIndex, { min: 0, max: 200, fallback: base.glassIndex, integer: true }),
    face: readString(source.face, MAX_SHORT_TEXT, base.face),
    margin: readNumber(source.margin, { min: 0, max: 95, fallback: base.margin }),
    installation: readNumber(source.installation, { min: 0, max: 10_000_000, fallback: base.installation }),
    transport: readNumber(source.transport, { min: 0, max: 10_000_000, fallback: base.transport }),
    discount: readNumber(source.discount, { min: 0, max: 95, fallback: base.discount }),
    client: readString(source.client, MAX_SHORT_TEXT),
    clientAddress: readString(source.clientAddress, MAX_TEXT),
    clientPhone: readString(source.clientPhone, MAX_SHORT_TEXT),
    clientEmail: readString(source.clientEmail, MAX_SHORT_TEXT),
    deliveryDate: readString(source.deliveryDate, 40),
    tree,
    marco: readMarco(source.marco),
    // La hoja seleccionada se reapunta a la primera del árbol leído: los ids se regeneraron, así
    // que el `selectedId` del archivo ya no señala a nada.
    selectedId: firstLeafIdOf(tree),
    termsHeader: readString(source.termsHeader, MAX_TEXT, base.termsHeader),
    paymentTerms: readString(source.paymentTerms, MAX_TEXT, base.paymentTerms),
    barLengthMm: readNumber(source.barLengthMm, { min: 1000, max: 20_000, fallback: BAR_LENGTH_MM, integer: true }),
    // El estado del asesor NO se importa. Es una conversación y una propuesta de la sesión que lo
    // generó, no una propiedad del producto, y aceptarla de un archivo sería aceptar cambios
    // sugeridos que nadie de este lado revisó.
  };
}

function firstLeafIdOf(node: FrameNode): string {
  return node.kind === "leaf" ? node.id : firstLeafIdOf(node.children[0]);
}

function readConfigState(value: unknown): ComponentConfigState {
  return value === "ok" || value === "alertas" ? value : "pendiente";
}

function readComponent(value: unknown, exportedAt: string): ProjectFileComponent {
  const source = record(value);
  const data = readComponentData(source.data);
  const createdAt = readIsoDate(source.createdAt, exportedAt);
  return {
    code: readString(source.code, MAX_SHORT_TEXT),
    designation: readString(source.designation, MAX_SHORT_TEXT, "V01"),
    location: readString(source.location, MAX_SHORT_TEXT),
    qty: readNumber(source.qty, { min: 1, max: 100_000, fallback: 1, integer: true }),
    widthMm: readNumber(source.widthMm, { min: 1, max: 100_000, fallback: 1000, integer: true }),
    heightMm: readNumber(source.heightMm, { min: 1, max: 100_000, fallback: 1000, integer: true }),
    // La marca decide qué catálogo se lee (data/catalog.ts); una desconocida dejaría el sistema en
    // `undefined` y con él todo el cálculo.
    brand: source.brand === "Deceuninck" ? "Deceuninck" : "Aluplast",
    systemIndex: readNumber(source.systemIndex, { min: 0, max: 200, fallback: 0, integer: true }),
    colorIndex: readNumber(source.colorIndex, { min: 0, max: 200, fallback: 0, integer: true }),
    glassIndex: readNumber(source.glassIndex, { min: 0, max: 200, fallback: data.glassIndex, integer: true }),
    typology: readString(source.typology, MAX_SHORT_TEXT),
    configState: readConfigState(source.configState),
    unitPrice: readNumber(source.unitPrice, { min: 0, max: 1_000_000_000, fallback: 0, integer: true }),
    total: readNumber(source.total, { min: 0, max: 1_000_000_000, fallback: 0, integer: true }),
    createdAt,
    updatedAt: readIsoDate(source.updatedAt, createdAt),
    data,
  };
}

function readProjectMeta(value: unknown, exportedAt: string): ProjectFileMeta {
  const source = record(value);
  const createdAt = readIsoDate(source.createdAt, exportedAt);
  return {
    name: readString(source.name, MAX_SHORT_TEXT, "Proyecto importado"),
    folio: readString(source.folio, MAX_SHORT_TEXT),
    origin: isProjectOrigin(source.origin) ? source.origin : "platform",
    status: isProjectStatus(source.status) ? source.status : INITIAL_PROJECT_STATUS,
    requester: normalizeRequester(source.requester, { now: exportedAt, createdAt, updatedAt: exportedAt }),
    currency: readString(source.currency, 12, "MXN"),
    pricingListId: readString(source.pricingListId, MAX_SHORT_TEXT),
    notes: readString(source.notes, MAX_TEXT),
    estimatedDate: readString(source.estimatedDate, 40),
    createdBy: readString(source.createdBy, MAX_SHORT_TEXT),
    createdAt,
    updatedAt: readIsoDate(source.updatedAt, createdAt),
    originalCreatedAt: readOptionalIsoDate(source.originalCreatedAt),
  };
}

// ---------- Migración entre versiones ----------

/**
 * Migraciones de esquema del archivo, de la versión N a la N+1.
 *
 * Hoy está vacío porque solo existe la versión 1, y ese es justamente el momento de dejar puesto el
 * mecanismo: cuando haya una versión 2, el archivo de la 1 tiene que seguir abriendo. Cada entrada
 * recibe el objeto crudo (sin validar) y devuelve el objeto crudo de la versión siguiente; la
 * validación ocurre una sola vez al final, sobre el resultado ya migrado.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

function migrate(raw: Record<string, unknown>, from: number): { raw: Record<string, unknown>; migratedFrom: number | null } {
  let version = from;
  let current = raw;
  let migrated = false;
  while (version < PROJECT_FILE_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    current = step(current);
    version += 1;
    migrated = true;
  }
  return { raw: current, migratedFrom: migrated ? from : null };
}

// ---------- Exportación ----------

/** Nombre de archivo legible y seguro para el sistema de archivos. */
export function projectFileName(folio: string, name: string): string {
  const slug = `${folio ? `${folio}_` : ""}${name}`
    .normalize("NFD")
    // Se quitan los diacríticos ya separados por NFD (rango de marcas combinantes) para que
    // "Cotización" no acabe como "Cotizaci_n" al filtrar los caracteres no ASCII de abajo.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return `${slug || "proyecto"}.${PROJECT_FILE_EXTENSION}`;
}

export function serializeProject(
  project: ProjectRecord,
  projectComponents: ComponentRecord[],
  options: { exportedBy: string; exportedAt?: string }
): ProjectFile {
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  return {
    kind: PROJECT_FILE_KIND,
    schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
    exportedAt,
    exportedBy: options.exportedBy,
    sourceProjectId: project.id,
    project: {
      name: project.name,
      folio: project.folio,
      origin: project.origin,
      status: project.status,
      requester: project.requester,
      currency: project.currency,
      pricingListId: project.pricingListId,
      notes: project.notes,
      estimatedDate: project.estimatedDate,
      createdBy: project.createdBy,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      // La fecha de creación original que se exporta es la del proyecto tal como existe aquí: si ya
      // era un proyecto importado se conserva la que traía, y si nació aquí es su propia fecha de
      // creación. Así la cadena exportar -> importar -> exportar no pierde el dato ni lo reescribe.
      originalCreatedAt: project.originalCreatedAt ?? project.createdAt,
    },
    components: projectComponents.map((component) => ({
      code: component.code,
      designation: component.designation,
      location: component.location,
      qty: component.qty,
      widthMm: component.widthMm,
      heightMm: component.heightMm,
      brand: component.brand,
      systemIndex: component.systemIndex,
      colorIndex: component.colorIndex,
      glassIndex: component.glassIndex,
      typology: component.typology,
      configState: component.configState,
      unitPrice: component.unitPrice,
      total: component.total,
      createdAt: component.createdAt,
      updatedAt: component.updatedAt,
      data: component.data,
    })),
  };
}

export function serializeBackup(files: ProjectFile[], options: { exportedBy: string; exportedAt?: string }): BackupFile {
  return {
    kind: BACKUP_FILE_KIND,
    schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    exportedBy: options.exportedBy,
    projects: files,
  };
}

// ---------- Importación ----------

export type ParseResult<T> =
  | { ok: true; value: T; warnings: string[]; migratedFrom: number | null }
  | { ok: false; error: string };

/** Lo que se rechaza de plano, antes de mirar el contenido. */
function readEnvelope(raw: unknown, kind: string): { ok: true; source: Record<string, unknown> } | { ok: false; error: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "El archivo no contiene un proyecto: se esperaba un objeto JSON." };
  }
  const source = raw as Record<string, unknown>;
  if (source.kind !== kind) {
    return {
      ok: false,
      error:
        kind === PROJECT_FILE_KIND
          ? "Ese archivo no es un proyecto de LUFT PVC. Falta la marca del formato."
          : "Ese archivo no es una copia de seguridad de LUFT PVC.",
    };
  }
  const version = typeof source.schemaVersion === "number" ? source.schemaVersion : 0;
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: "El archivo no declara una versión de formato válida." };
  }
  if (version > PROJECT_FILE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `El archivo fue creado con una versión más reciente de la plataforma (formato ${version}, aquí se entiende hasta ${PROJECT_FILE_SCHEMA_VERSION}). Actualiza para poder abrirlo.`,
    };
  }
  return { ok: true, source };
}

/**
 * Convierte texto en un proyecto listo para guardar, o en un error legible.
 *
 * Nunca lanza sobre contenido malformado: un archivo inválido es un resultado, no una excepción, y
 * la interfaz muestra el mensaje sin quedarse a medias. Sí devuelve avisos cuando tuvo que corregir
 * algo (un componente descartado, un árbol recortado), porque importar en silencio un proyecto al
 * que le faltan piezas es peor que importarlo diciéndolo.
 */
export function parseProjectFile(text: string): ParseResult<ProjectFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "El archivo no es JSON válido o está incompleto." };
  }

  const envelope = readEnvelope(raw, PROJECT_FILE_KIND);
  if (!envelope.ok) return envelope;

  const declaredVersion = envelope.source.schemaVersion as number;
  const { raw: migratedRaw, migratedFrom } = migrate(envelope.source, declaredVersion);
  if (migratedFrom === null && declaredVersion < PROJECT_FILE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `No hay forma de migrar un archivo con formato ${declaredVersion} a ${PROJECT_FILE_SCHEMA_VERSION}.`,
    };
  }

  const warnings: string[] = [];
  const exportedAt = readIsoDate(migratedRaw.exportedAt, new Date().toISOString());
  const rawComponents = Array.isArray(migratedRaw.components) ? migratedRaw.components : [];
  if (!Array.isArray(migratedRaw.components)) {
    warnings.push("El archivo no traía lista de componentes; el proyecto se importa vacío.");
  }
  if (rawComponents.length > MAX_COMPONENTS) {
    warnings.push(`El archivo declara ${rawComponents.length} componentes; se importaron los primeros ${MAX_COMPONENTS}.`);
  }

  const parsedComponents = rawComponents
    .slice(0, MAX_COMPONENTS)
    .map((component, index) => {
      try {
        return readComponent(component, exportedAt);
      } catch {
        // Un componente ilegible no puede tumbar la importación completa: se descarta ese y se
        // avisa, que es lo que permite recuperar un archivo parcialmente dañado.
        warnings.push(`El componente ${index + 1} venía dañado y se omitió.`);
        return null;
      }
    })
    .filter((component): component is ProjectFileComponent => component !== null);

  return {
    ok: true,
    warnings,
    migratedFrom,
    value: {
      kind: PROJECT_FILE_KIND,
      schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
      exportedAt,
      exportedBy: readString(migratedRaw.exportedBy, MAX_SHORT_TEXT, "desconocido"),
      sourceProjectId: readString(migratedRaw.sourceProjectId, 80),
      project: readProjectMeta(migratedRaw.project, exportedAt),
      components: parsedComponents,
    },
  };
}

export function parseBackupFile(text: string): ParseResult<BackupFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "El archivo no es JSON válido o está incompleto." };
  }

  const envelope = readEnvelope(raw, BACKUP_FILE_KIND);
  if (!envelope.ok) return envelope;

  const rawProjects = Array.isArray(envelope.source.projects) ? envelope.source.projects : [];
  if (rawProjects.length === 0) {
    return { ok: false, error: "La copia de seguridad no contiene ningún proyecto." };
  }

  const warnings: string[] = [];
  if (rawProjects.length > MAX_BACKUP_PROJECTS) {
    warnings.push(`La copia declara ${rawProjects.length} proyectos; se restauraron los primeros ${MAX_BACKUP_PROJECTS}.`);
  }

  const files: ProjectFile[] = [];
  rawProjects.slice(0, MAX_BACKUP_PROJECTS).forEach((entry, index) => {
    // Cada proyecto de la copia se valida con el mismo lector que un archivo suelto: una copia de
    // seguridad no es más confiable por venir en lote.
    const parsed = parseProjectFile(JSON.stringify(entry));
    if (parsed.ok) {
      files.push(parsed.value);
      warnings.push(...parsed.warnings.map((warning) => `Proyecto ${index + 1}: ${warning}`));
    } else {
      warnings.push(`Proyecto ${index + 1}: ${parsed.error}`);
    }
  });

  if (files.length === 0) return { ok: false, error: "Ningún proyecto de la copia de seguridad se pudo leer." };

  return {
    ok: true,
    warnings,
    migratedFrom: null,
    value: {
      kind: BACKUP_FILE_KIND,
      schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
      exportedAt: readIsoDate(envelope.source.exportedAt, new Date().toISOString()),
      exportedBy: readString(envelope.source.exportedBy, MAX_SHORT_TEXT, "desconocido"),
      projects: files,
    },
  };
}
