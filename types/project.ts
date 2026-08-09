import type { Brand, FrameNode, Marco } from "./domain";

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

export type ProjectRecord = {
  id: string;
  name: string;
  activeComponentId: string | null;
  createdAt: string;
  updatedAt: string;
  components: ComponentSummary[];
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
