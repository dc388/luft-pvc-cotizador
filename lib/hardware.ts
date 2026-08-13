import type { PaneSpec, WingType } from "@/types/domain";
import { MOVABLE_SLIDING_WINGS } from "@/lib/tree";

// ---------------------------------------------------------------------------
// Cómo se coloca la herrajería de una hoja en el dibujo.
//
// Antes el dibujo pintaba una tuerca fija abajo a la izquierda de cada hoja operable: no
// dependía del tipo de apertura, ni de la dirección, ni de la altura de manilla capturada en el
// panel, así que dos hojas con configuraciones opuestas se veían idénticas. Este módulo es la
// única fuente de verdad de dónde va cada pieza, y tanto el lienzo 2D como el diagrama del
// informe lo consumen: si cambia una regla, cambian los dos.
//
// CONVENCIONES (explícitas porque "apertura derecha" no significa lo mismo en todos los
// talleres, y una convención escrita se puede discutir; una implícita no):
//
//   · Corrediza — `direction` es el sentido de desplazamiento. La manilla va en el montante
//     hacia el que corre la hoja, que es el que queda al centro en una corrediza de 2 hojas
//     (izquierda corre a la derecha, derecha corre a la izquierda: las dos manillas se
//     encuentran al centro, como en obra).
//   · Practicable / abatible / oscilobatiente / puerta — `direction` nombra el LADO DE LA
//     MANILLA. Las bisagras van enfrente. "Interior"/"Exterior" describen hacia dónde abre,
//     no de qué lado, así que en esos casos se usa el lado por omisión (derecha).
//   · Proyectante — bisagra arriba, manilla abajo al centro. Proyectante inferior, al revés.
//   · Pivotante — sin bisagra de canto: gira sobre dos puntos centrales arriba y abajo.
//
// `handlePosition` se mide en mm DESDE EL CANTO INFERIOR de la hoja. Es lo que ya guardaba el
// modelo (PaneSpec.handlePosition, por omisión 1000 mm ≈ altura de mano), solo que hasta ahora
// nadie lo dibujaba.
// ---------------------------------------------------------------------------

export type Edge = "left" | "right" | "top" | "bottom";
/** Familia de manilla, no su catálogo: lo que cambia es la silueta que se dibuja. */
export type HandleKind = "lever" | "bar" | "flush" | "crank" | "none";
/** Símbolo normalizado del sentido de apertura (líneas del alzado). */
export type OpeningSymbol = "none" | "casement" | "tilt-turn" | "project" | "hopper" | "pivot";

export type SashHardware = {
  /** La hoja se mueve: hay manilla, y por tanto hay algo que dibujar. */
  operable: boolean;
  /** Hoja de la familia corrediza que sí desplaza (excluye "corredera fija"). */
  sliding: boolean;
  /** Sentido de desplazamiento de una corrediza. */
  slideDir: "left" | "right" | null;
  /** Canto con bisagras, o null en corredizas, pivotantes y hojas fijas. */
  hingeEdge: Edge | null;
  /** Canto donde se monta la manilla. */
  handleEdge: Edge | null;
  handleKind: HandleKind;
  /** Posición de la manilla sobre su canto, 0..1. En cantos verticales se mide desde abajo. */
  handleOffset: number;
  symbol: OpeningSymbol;
  /** Puntos de cierre a dibujar sobre el montante de cierre (0 = herraje sin multipunto). */
  lockPoints: number;
  /** Pivotes centrales arriba/abajo (solo pivotante). */
  pivot: boolean;
};

const FIXED_WINGS: WingType[] = ["fixed", "inactive", "sliding-fixed"];
const HINGED_SIDE_WINGS: WingType[] = ["casement-in", "casement-out", "tilt-turn", "door"];

/** Lado de la manilla para una hoja de canto vertical. "Derecha"/"Izquierda" mandan; el resto
 *  ("Interior", "Exterior", "N/A" de proyectos guardados antes de que estas hojas tuvieran
 *  dirección) cae en derecha, que es la mano más común. */
function sideFromDirection(direction: string): "left" | "right" {
  return direction === "Izquierda" ? "left" : "right";
}

function handleKindFor(handle: string): HandleKind {
  if (!handle || handle === "Sin manilla") return "none";
  if (handle.includes("Manillón")) return "bar";
  if (handle.includes("embutido")) return "flush";
  if (handle.includes("Manivela")) return "crank";
  return "lever";
}

function lockPointsFor(hardware: string): number {
  if (!hardware || hardware === "Sin herraje") return 0;
  if (hardware.includes("multipunto")) return 3;
  if (hardware.includes("osciloparalela")) return 2;
  if (hardware.includes("Bisagra") || hardware.includes("Bisagras")) return 1;
  return 0;
}

/** Posición 0..1 de la manilla sobre un canto vertical, desde abajo. Se recorta a los extremos
 *  para que una captura fuera de rango (0 mm, o más que el alto de la hoja) no saque el dibujo
 *  de la hoja: el valor sigue siendo el que capturó el usuario, solo se dibuja dentro. */
function verticalOffset(handlePosition: number, leafHeightMm: number): number {
  if (!Number.isFinite(handlePosition) || handlePosition <= 0 || leafHeightMm <= 0) return 0.5;
  return Math.min(0.92, Math.max(0.08, handlePosition / leafHeightMm));
}

export function resolveSashHardware(wing: WingType, spec: PaneSpec, leafHeightMm: number): SashHardware {
  const none: SashHardware = {
    operable: false,
    sliding: false,
    slideDir: null,
    hingeEdge: null,
    handleEdge: null,
    handleKind: "none",
    handleOffset: 0.5,
    symbol: "none",
    lockPoints: 0,
    pivot: false,
  };
  if (FIXED_WINGS.includes(wing)) return none;

  const handleKind = handleKindFor(spec.handle);
  const lockPoints = lockPointsFor(spec.hardware);
  const vOffset = verticalOffset(spec.handlePosition, leafHeightMm);

  if (MOVABLE_SLIDING_WINGS.includes(wing)) {
    const dir = sideFromDirection(spec.direction);
    return { ...none, operable: true, sliding: true, slideDir: dir, handleEdge: dir, handleKind, handleOffset: vOffset, lockPoints };
  }

  if (HINGED_SIDE_WINGS.includes(wing)) {
    const handleEdge = sideFromDirection(spec.direction);
    return {
      ...none,
      operable: true,
      hingeEdge: handleEdge === "left" ? "right" : "left",
      handleEdge,
      handleKind,
      handleOffset: vOffset,
      symbol: wing === "tilt-turn" ? "tilt-turn" : "casement",
      lockPoints,
    };
  }

  if (wing === "project") {
    return { ...none, operable: true, hingeEdge: "top", handleEdge: "bottom", handleKind, handleOffset: 0.5, symbol: "project", lockPoints };
  }
  if (wing === "hopper") {
    return { ...none, operable: true, hingeEdge: "bottom", handleEdge: "top", handleKind, handleOffset: 0.5, symbol: "hopper", lockPoints };
  }
  if (wing === "pivot") {
    const handleEdge = sideFromDirection(spec.direction);
    return { ...none, operable: true, handleEdge, handleKind, handleOffset: vOffset, symbol: "pivot", lockPoints, pivot: true };
  }
  if (wing === "jalousie") {
    // Persiana de cristal: no tiene hoja que gire, tiene una manivela a un costado.
    const handleEdge = sideFromDirection(spec.direction);
    return { ...none, operable: true, handleEdge, handleKind: handleKind === "none" ? "none" : "crank", handleOffset: vOffset };
  }

  return { ...none, operable: true, handleEdge: sideFromDirection(spec.direction), handleKind, handleOffset: vOffset, lockPoints };
}

/** Texto de la ayuda emergente de la manilla: dice qué representa, para que el dibujo se pueda
 *  verificar contra la ficha sin abrirla. */
export function handleTitle(hw: SashHardware, spec: PaneSpec): string {
  if (hw.handleKind === "none") return "Sin manilla";
  const edge = hw.handleEdge === "left" ? "izquierda" : hw.handleEdge === "right" ? "derecha" : hw.handleEdge === "top" ? "arriba" : "abajo";
  const pos = hw.handleEdge === "left" || hw.handleEdge === "right" ? ` · ${Math.round(spec.handlePosition)} mm` : "";
  return `${spec.handle} — ${edge}${pos}`;
}
