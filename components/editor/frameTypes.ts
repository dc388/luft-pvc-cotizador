// Shared small types for the compositional editor's hit-testing/selection UI —
// split out so FrameNodeView/FrameCanvas/ExplorerTree/CentralLocks/AssemblyMarcoHits
// all agree on the same vocabulary without importing from each other.
export type PartKind = "marco" | "hoja" | "vidrio" | "herraje";
export type SideKey = "top" | "bottom" | "left" | "right";
// Edges/EdgeValue now live in lib/tree.ts -- flattenToLeafFrames needs the same
// classification to size real hoja fabrication, so it's the single source of truth.
export type { EdgeValue, Edges } from "@/lib/tree";

export const SIDES: SideKey[] = ["top", "bottom", "left", "right"];
export const SIDE_LABELS: Record<SideKey, string> = { top: "Arriba", bottom: "Abajo", left: "Izquierda", right: "Derecha" };
