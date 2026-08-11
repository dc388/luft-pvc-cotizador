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
  data: ComponentData;
  createdAt: string;
  updatedAt: string;
};

// Lightweight shape for the Proyecto tab's outliner list -- no tree/marco payload, so
// switching a large project's list around doesn't drag every component's full JSON along.
export type ComponentSummary = Omit<ComponentRecord, "data">;

/** De dónde salió el proyecto: lo capturó un cliente en /cotizar, o lo abrió el equipo. */
export type ProjectSource = "web" | "interno";

export type ProjectRecord = {
  id: string;
  name: string;
  activeComponentId: string | null;
  source: ProjectSource;
  /** Folio público (W-XXXXXX) cuando `source` es "web"; cadena vacía en los internos. */
  folio: string;
  /** Cliente capturado por el cotizador público; cadena vacía en los internos. */
  client: string;
  createdAt: string;
  updatedAt: string;
  components: ComponentSummary[];
};

// Una fila de la lista de proyectos ("carpetas") del tab Proyecto. No arrastra los componentes:
// solo cuánto hay dentro y su total de piezas, que es lo que se alcanza a leer en la lista.
export type ProjectSummary = {
  id: string;
  name: string;
  source: ProjectSource;
  folio: string;
  client: string;
  componentCount: number;
  pieceCount: number;
  createdAt: string;
  updatedAt: string;
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
  data: Partial<ComponentData>;
}>;
