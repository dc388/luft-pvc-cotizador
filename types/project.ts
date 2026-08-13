import type { Brand, FrameNode, Marco } from "./domain";
import type { LuftAgentState } from "./luft-ai";

// Everything about a component that isn't promoted to its own normalized DB column --
// still shaped exactly like the fields lib/persistence.ts used to keep flat before the
// Proyecto/Componente layer existed, just nested under `data` now.
export type ComponentData = {
  rail: number;
  glassIndex: number;
  face: string;
  margin: number;
  installation: number;
  transport: number;
  discount: number;
  client: string;
  clientAddress: string;
  deliveryDate: string;
  /** Contacto capturado por el cotizador público (app/cotizar) -- opcionales porque los
   * componentes creados antes de que existiera ese flujo no los traen en su JSON. */
  clientPhone?: string;
  clientEmail?: string;
  selectedId: string;
  tree: FrameNode;
  marco: Marco;
  /** Free-text opening line of the client quote's terms page (RA Workshop's "Texto Principal"). */
  termsHeader: string;
  /** Free-text payment/warranty conditions body (RA Workshop's "Texto Secundario") -- editable per
   * component so a project-specific deposit split or warranty note doesn't require a code change. */
  paymentTerms: string;
  /** Commercial stock bar length (mm) used for this component's cut-list optimization --
   * see lib/calc.ts's BAR_LENGTH_MM for the historical default and Consumo tab's selector. */
  barLengthMm: number;
  /** Phase-1 LUFT AI review/proposal state. Optional for backwards compatibility with every
   * component persisted before the agent layer existed. Domain calculations never read it. */
  luftAi?: LuftAgentState;
};

/** En qué punto está la configuración de un componente. Lo escribe quien lo edita, porque es lo
 * único que puede saberlo: recalcularlo para toda la lista exigiría cargar el árbol de cada
 * componente, que es justo el payload que ComponentSummary evita. "pendiente" es el valor de
 * partida y también el de los componentes guardados antes de que este campo existiera -- se
 * muestra como "sin verificar", no como correcto. */
export type ComponentConfigState = "pendiente" | "ok" | "alertas";

export type ComponentRecord = {
  id: string;
  projectId: string;
  position: number;
  code: string;
  designation: string;
  location: string;
  qty: number;
  widthMm: number;
  heightMm: number;
  brand: Brand;
  systemIndex: number;
  colorIndex: number;
  /** Índice del vidrio general en glassCatalog. Columna (y no solo `data.glassIndex`) para que
   * la lista de componentes pueda decir qué vidrio lleva cada uno sin cargar su configuración. */
  glassIndex: number;
  /** Tipología resuelta ("Corrediza + Fijo"), calculada del árbol por quien lo edita. */
  typology: string;
  configState: ComponentConfigState;
  /** Precio de venta por pieza y subtotal (precio × cantidad) en pesos redondeados, tal como los
   * calculó lib/calc.ts la última vez que se guardó. Son caché de lectura: la fuente de verdad
   * sigue siendo el cálculo sobre la configuración, que se rehace al abrir el componente. */
  unitPrice: number;
  total: number;
  data: ComponentData;
  createdAt: string;
  updatedAt: string;
};

// Lightweight shape for the Proyecto tab's outliner list -- no tree/marco payload, so
// switching a large project's list around doesn't drag every component's full JSON along.
export type ComponentSummary = Omit<ComponentRecord, "data">;

/** De dónde salió el proyecto: lo capturó un cliente en /cotizar, o lo abrió el equipo. */
export type ProjectSource = "web" | "interno";

/** Las dos categorías del explorador de proyectos.
 *
 * "imported" es todo lo que entró desde fuera de esta pantalla: un archivo .luftproj abierto, un
 * respaldo restaurado, o una cotización que un cliente envió desde /cotizar. "platform" es lo que
 * alguien del equipo creó aquí dentro.
 *
 * Es una columna aparte de `source` y no un valor más de ella a propósito: `source` responde "¿lo
 * capturó el cliente en el cotizador público?", que sigue cambiando lo que se muestra (folio
 * público, insignia WEB) y de dónde salieron los datos. `origin` responde "¿nació aquí o llegó de
 * fuera?", que es lo que organiza las carpetas. Un proyecto interno exportado y vuelto a importar
 * es source="interno" y origin="imported": las dos preguntas tienen respuestas distintas. */
export type ProjectOrigin = "platform" | "imported";

/** Etapa del proyecto. "archived" no vive aquí sino en `archivedAt`: archivar es reversible y no
 * debe borrar en qué etapa comercial iba el proyecto (ver lib/projectStatus.ts). */
export type ProjectStatus = "draft" | "in_progress" | "quoted" | "approved" | "rejected";

export type Address = {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

/** Quien pide la cotización. Todos los campos son cadenas (vacía = sin capturar) en vez de
 * opcionales: así el formulario, la exportación y la importación no tienen que distinguir entre
 * "no capturado" y "ausente del archivo", que era una fuente de campos perdidos al reimportar.
 * Las direcciones de instalación y facturación sí son nulables, porque `null` significa algo
 * distinto de vacío: "la misma que la dirección principal". */
export type Requester = {
  fullName: string;
  company: string;
  phone: string;
  alternatePhone: string;
  email: string;
  taxId: string;
  contactPerson: string;
  acquisitionChannel: string;
  notes: string;
  address: Address;
  installationAddress: Address | null;
  billingAddress: Address | null;
  /** Cuándo se registró el solicitante y cuándo se actualizó por última vez su ficha. */
  createdAt: string;
  updatedAt: string;
};

/** Metadatos comerciales y administrativos del proyecto, sin sus componentes. */
export type ProjectMeta = {
  id: string;
  name: string;
  folio: string;
  origin: ProjectOrigin;
  source: ProjectSource;
  status: ProjectStatus;
  requester: Requester;
  currency: string;
  pricingListId: string;
  notes: string;
  /** Fecha estimada del proyecto (YYYY-MM-DD), capturada al crearlo. */
  estimatedDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Cuándo entró a esta plataforma, si llegó de fuera. */
  importedAt: string | null;
  /** Fecha de creación original que traía el archivo importado, cuando venía en él. */
  originalCreatedAt: string | null;
  archivedAt: string | null;
  /** Papelera: un proyecto borrado se marca, no se elimina (ver deleteProject). */
  deletedAt: string | null;
  /** Proyecto del que se duplicó, si se duplicó de alguno. */
  duplicatedFromId: string | null;
  schemaVersion: number;
};

export type ProjectRecord = ProjectMeta & {
  activeComponentId: string | null;
  /** Cliente tal como lo capturó el cotizador público. Se conserva sincronizado con
   * `requester.fullName` para no romper lo que ya lo leía (etiquetado de folios, informes). */
  client: string;
  components: ComponentSummary[];
};

// Una fila de la lista de proyectos del explorador. No arrastra los componentes: solo cuánto hay
// dentro, su total de piezas y su importe, que es lo que se alcanza a leer en la lista. Lleva
// además los datos del solicitante por los que se busca y se filtra, para que el buscador no
// tenga que pedir cada proyecto completo.
export type ProjectSummary = Omit<ProjectMeta, "requester" | "notes"> & {
  client: string;
  company: string;
  phone: string;
  email: string;
  componentCount: number;
  pieceCount: number;
  /** Suma de los subtotales de sus componentes, en pesos redondeados. */
  total: number;
};

export type ComponentPatch = Partial<{
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
  data: Partial<ComponentData>;
}>;

/** Lo que el alta de proyecto puede fijar de entrada. Todo es opcional salvo el nombre: la ficha
 * del solicitante se puede terminar después (ver §4 del pedido: nada de datos fiscales
 * obligatorios para poder crear un proyecto). */
export type ProjectDraft = {
  name: string;
  requester?: Partial<Requester>;
  currency?: string;
  pricingListId?: string;
  notes?: string;
  estimatedDate?: string;
  createdBy?: string;
};

export type ProjectMetaPatch = Partial<{
  name: string;
  status: ProjectStatus;
  requester: Partial<Requester>;
  currency: string;
  pricingListId: string;
  notes: string;
  estimatedDate: string;
  activeComponentId: string;
}>;

/** Por qué existe un punto de restauración. Ver la tabla project_versions. */
export type ProjectVersionReason = "manual" | "antes-de-importar" | "antes-de-restaurar";

/** Un punto de restauración, sin su contenido: el snapshot es el proyecto entero y no se arrastra a
 *  la lista. */
export type ProjectVersionRow = {
  id: string;
  projectId: string;
  label: string;
  reason: ProjectVersionReason;
  componentCount: number;
  total: number;
  createdAt: string;
};

/** Cierre de obra: lo que costó y se cobró de verdad frente a lo cotizado. `quotedTotal` y
 *  `quotedPieces` quedan congelados al cerrar, para que la comparación sea contra lo que se cotizó
 *  entonces y no contra lo que diría el catálogo hoy. */
export type ProjectOutcome = {
  projectId: string;
  quotedTotal: number;
  quotedPieces: number;
  actualCost: number;
  actualRevenue: number;
  piecesBuilt: number;
  notes: string;
  closedAt: string;
  updatedAt: string;
};
