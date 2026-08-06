export type Brand = "Aluplast" | "Deceuninck";
export type Tab = "Resumen" | "Diseño" | "Consumo" | "Servicios" | "Informes";
export type Report = "Oferta" | "Producción" | "Perfiles" | "Herrajes" | "Vidrio" | "Costos";
export type ViewMode = "Frente" | "Sección" | "3D";

export type PaneSpec = {
  state: string;
  opening: string;
  direction: string;
  hardware: string;
  handle: string;
  glass: string;
  notes: string;
  /** Exterior louvre shutter accessory (Mallorquina) — not a wing type, see lib/tree.ts. */
  mallorquina: boolean;
};

// Opening/leaf types a cell in the composed window can be assigned, modeled on
// RA Workshop's "Wings" toolbox palette.
export type WingType =
  | "fixed"
  | "sliding"
  | "lift-slide"
  | "folding-sliding"
  | "casement-in"
  | "casement-out"
  | "tilt-turn"
  | "project"
  | "hopper"
  | "jalousie"
  | "pivot"
  | "door"
  | "inactive";

// A window/door is a tree: SplitNodes divide a rectangle into N proportional
// (ratios sum to 1) child rectangles along one axis; LeafNodes are the actual
// panes, each carrying its own opening type and PaneSpec. Ratios (not mm) mean
// the tree renders correctly at any W×H without needing to be rescaled.
export type SplitNode = {
  kind: "split";
  id: string;
  axis: "row" | "col"; // "col" = side-by-side children, "row" = stacked children
  ratios: number[];
  children: FrameNode[];
};

export type LeafNode = {
  kind: "leaf";
  id: string;
  wing: WingType;
  spec: PaneSpec;
};

export type FrameNode = SplitNode | LeafNode;

// Active tool in the compositional editor's toolbox.
export type Tool =
  | { mode: "select" }
  | { mode: "split"; axis: "row" | "col" }
  | { mode: "assign-wing"; wing: WingType };

export type System = {
  name: string;
  category: string;
  depth: number;
  chambers: string;
  glazing: number;
  maxW: number;
  maxH: number;
  rails: number[];
  frame: number;
  sash: number;
  hardware: number;
  uf: string;
  /** true when frame/sash are real EUR->MXN prices from the Aluplast EXWORK Veracruz
   * price list (rev. ABR_22, 2022-05-01), not an estimate. See lib/pricing.ts. */
  sourced?: boolean;
};

export type GlassItem = { name: string; thickness: number; price: number; type: string };
export type ColorItem = { name: string; code: string; factor: number };
export type ProfileItem = { code: string; name: string; role: string; status: string };
export type ProfileFamily = { system: string; name: string; code: string; priceEUR: number; variants: number };
