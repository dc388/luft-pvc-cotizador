// Shared small types for the compositional editor's hit-testing/selection UI —
// split out so FrameNodeView/FrameCanvas/ExplorerTree/CentralLocks/AssemblyMarcoHits
// all agree on the same vocabulary without importing from each other.
export type PartKind = "marco" | "hoja" | "vidrio" | "herraje";
export type SideKey = "top" | "bottom" | "left" | "right";
export type EdgeValue = boolean | "overlap";
export type Edges = { top: EdgeValue; right: EdgeValue; bottom: EdgeValue; left: EdgeValue };

export const SIDES: SideKey[] = ["top", "bottom", "left", "right"];
export const SIDE_LABELS: Record<SideKey, string> = { top: "Arriba", bottom: "Abajo", left: "Izquierda", right: "Derecha" };
