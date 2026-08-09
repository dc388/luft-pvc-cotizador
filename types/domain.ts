export type Brand = "Aluplast" | "Deceuninck";
export type Tab = "Proyecto" | "Resumen" | "Diseño" | "Consumo" | "Servicios" | "Informes";
export type Report = "Cotización" | "Optimización de corte" | "Pedido de vidrio" | "Producción" | "Herrajes" | "Costos";
export type ViewMode = "2D" | "Sección" | "3D";
export type ViewPreset3D = "Frente" | "Planta" | "Perfil" | "Isométrica";

// One side (top/bottom/left/right) of a leaf's own marco, or of the assembly
// marco — an independently selectable/editable sub-part, not just informative
// text on the whole frame.
export type Side = { reinforcement: boolean; notes: string };
export type Sides = Record<"top" | "bottom" | "left" | "right", Side>;

// One side of a leaf's glass/glazing bead — cut geometry of the junquillo
// (length comes from the leaf rect itself; angulo1/angulo2/radio/arco describe
// the corner cut), matching what RA Workshop shows under Vidrio > Lado.
export type GlassSide = { angulo1: number; angulo2: number; radio: number; arco: number; notes: string };
export type GlassSides = Record<"top" | "bottom" | "left" | "right", GlassSide>;

// The marco of the whole opening (assembly-level frame), independent of each
// leaf's own marco — lives at state level, not inside the tree.
export type Marco = {
  profileCode: string;
  reinforcement: boolean;
  reinforcementCode: string;
  mosquitero: boolean;
  mosquiteroCode: string;
  persiana: boolean;
  persianaCode: string;
  sides: Sides;
};

// Which "level" the current selection focuses: a leaf inside the tree, or the
// assembly marco (state.marco) that isn't part of the tree at all.
export type FocusScope = "leaf" | "assembly";

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
  sides: Sides;
  glassSides: GlassSides;
  /** Pocket-system type; only meaningful for movable sliding wings (see MOVABLE_SLIDING_WINGS). */
  pocketType: string;
  useGancho: boolean;
  useAdaptador: boolean;
  /** Handle position along the leaf, in mm. 0 for fixed/inactive/sliding-fixed leaves. */
  handlePosition: number;
  /** This leaf's own profile family code (see lib/profileMatch.ts), independent of the window's
   * general System selection -- lets one component mix e.g. a 2-hojas marco family with a
   * leaf that actually needs the 3-hojas variant's stile. Empty string = not set. */
  profileCode: string;
  /** Which physical riel/carril (track) this leaf rides, for any leaf in the sliding family
   * (movable or "corredera fija" -- both sit in a track, see SLIDING_WINGS). 1-based; 0 for
   * leaves outside the sliding family, where the concept doesn't apply. */
  railIndex: number;
};

// Opening/leaf types a cell in the composed window can be assigned, modeled on
// RA Workshop's "Wings" toolbox palette.
export type WingType =
  | "fixed"
  | "sliding"
  | "lift-slide"
  | "folding-sliding"
  | "sliding-fixed"
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
  /** Marco->hoja seat: mm a sliding sash overlaps INTO the frame's channel on each outer
   * edge it contacts (top/bottom rail, or an outer jamb) -- the sash's real cut size is
   * inset by this much below its nominal share of the frame on those edges. Currently 8mm
   * across the board per dc's field measurement; not yet split out per system depth. */
  frameSeatMm: number;
  /** Traslape central: mm two sliding leaves overlap where they meet mid-run, so the
   * closed leaves seal against each other's stile instead of butting edge to edge (this is
   * what stops air/sound leaking through the center of a corredera). PLACEHOLDER pending
   * Aluplast's fabrication datasheet -- see data/catalog.ts. 0 for systems whose leaves
   * never meet a sliding sibling (Practicable/Fijo/Puerta). */
  centerOverlapMm: number;
};

export type GlassItem = { name: string; thickness: number; price: number; type: string };
export type ColorItem = { name: string; code: string; factor: number; hex?: string };
export type ProfileItem = { code: string; name: string; role: string; status: string };
export type ProfileFamily = { system: string; name: string; code: string; priceEUR: number; variants: number };
