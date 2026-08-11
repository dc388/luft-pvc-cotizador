import type { PublicCatalog, PublicStyle } from "@/lib/publicCatalog";
import type { AssistantBrief } from "@/lib/assistantBrief";
import type { WingType } from "@/types/domain";

// Traduce el brief acumulado a un estilo REAL del catálogo (§216-219, §263).
//
// Es la pieza que faltaba para que el asistente configure por el cliente en vez de esperar a
// que nombre una opción. No inventa nada: solo puntúa las entradas que ya existen en
// buildPublicCatalog() y descarta las que no soportan la medida pedida.
//
// Todo lo que decide "qué abre" se deriva de `style.wings`, que a su vez sale del árbol que
// construye la tipología en data/typologies.ts. Cambiar una tipología ahí se refleja aquí sin
// tocar este archivo.

const MOVABLE: WingType[] = ["sliding", "lift-slide", "folding-sliding", "casement-in", "casement-out", "tilt-turn", "project", "hopper", "pivot", "jalousie", "door"];
const SLIDING: WingType[] = ["sliding", "lift-slide", "folding-sliding", "sliding-fixed"];

export type StyleMatch = {
  style: PublicStyle;
  /** Explicación en lenguaje del cliente de por qué se propone (§219, §82). */
  reason: string;
  /** Fracción del ancho que queda libre al abrir, redondeada (§224, §226). */
  openingPercent: number;
};

export type BriefMatchResult = {
  best: StyleMatch;
  alternatives: StyleMatch[];
  /** Medidas a aplicar junto con el estilo, ya validadas contra sus límites. */
  widthMm: number;
  heightMm: number;
  /** Motivos por los que se descartaron opciones que el cliente podría esperar. */
  notes: string[];
};

function movablePanels(style: PublicStyle): number {
  return style.wings.filter((wing) => MOVABLE.includes(wing)).length;
}

function isSliding(style: PublicStyle): boolean {
  return style.wings.some((wing) => SLIDING.includes(wing));
}

function isHinged(style: PublicStyle): boolean {
  return style.wings.some((wing) => wing === "door" || wing === "casement-in" || wing === "casement-out");
}

// Porcentaje del ancho que se libera al abrir. Aproximado y declarado como tal: sirve para
// comparar alternativas, no como dato de fabricación.
function openingPercent(style: PublicStyle): number {
  if (style.panels <= 0) return 0;
  const movable = movablePanels(style);
  if (movable === 0) return 0;
  // En una corredera las hojas se apilan sobre sus vecinas: se libera como máximo la parte
  // proporcional de las hojas móviles menos el paño donde se recogen.
  if (isSliding(style)) return Math.round((Math.max(0, movable - (style.panels - movable === 0 ? 1 : 0)) / style.panels) * 100);
  // Abatible: la hoja despeja su hueco completo.
  return Math.round((movable / style.panels) * 100);
}

function fits(style: PublicStyle, widthMm: number, heightMm: number, minMm: number): boolean {
  if (widthMm > style.maxW || heightMm > style.maxH) return false;
  if (widthMm < minMm || heightMm < minMm) return false;
  return widthMm / Math.max(1, style.panels) >= minMm;
}

/**
 * Elige el mejor estilo para el brief. Devuelve null cuando todavía no hay medidas (sin ellas no
 * se puede descartar nada por límites) o cuando ninguna entrada del catálogo soporta el vano.
 */
export function matchBriefToStyle(brief: AssistantBrief, catalog: PublicCatalog): BriefMatchResult | null {
  const widthMm = brief.widthMm;
  const heightMm = brief.heightMm;
  if (!widthMm || !heightMm) return null;

  const notes: string[] = [];
  // La función del vano decide la categoría: si hay que pasar, es puerta. Deriva del brief, no
  // de una palabra suelta del mensaje.
  const wantedProduct = brief.accessRequired === true ? "puerta" : "ventana";
  const byProduct = catalog.styles.filter((style) => style.productId === wantedProduct);
  const pool = byProduct.length ? byProduct : catalog.styles;

  const feasible = pool.filter((style) => fits(style, widthMm, heightMm, catalog.minMm));
  if (!feasible.length) {
    const widest = pool.reduce((max, style) => Math.max(max, style.maxW), 0);
    const tallest = pool.reduce((max, style) => Math.max(max, style.maxH), 0);
    notes.push(`Con ${(widthMm / 1000).toFixed(2)} × ${(heightMm / 1000).toFixed(2)} m no hay estilo público que lo cubra: el máximo disponible es ${widest} × ${tallest} mm. Un asesor puede revisar una solución dividida.`);
    return null;
  }

  const scored = feasible.map((style) => {
    let score = 0;
    const movable = movablePanels(style);
    const percent = openingPercent(style);

    // Cantidad de hojas pedida explícitamente: es lo que más pesa, el cliente ya decidió.
    if (brief.leafCount) score += style.panels === brief.leafCount ? 60 : -Math.min(30, Math.abs(style.panels - brief.leafCount) * 12);

    if (brief.openingGoal === "maximum") score += percent * 0.5 + movable * 4;
    else if (brief.openingGoal === "view") score += (6 - Math.min(6, style.panels)) * 8 + (movable === 0 ? 12 : 0);
    else if (brief.openingGoal === "balanced") score += 20 - Math.abs(percent - 50) * 0.3;

    if (brief.accessRequired === true && movable === 0) score -= 50;
    if (brief.accessRequired === false && movable === 0) score += 10;

    // Hojas centrales móviles solo tiene sentido con 3 o más paños.
    if (brief.movingLeaves === "center") score += style.panels >= 3 ? 15 : 0;

    // Precio en firme por encima de estimado, a igualdad de todo lo demás (§217).
    if (!style.estimated) score += 8;
    if (brief.priorities?.includes("minimal_frame")) score += (6 - Math.min(6, style.panels)) * 4;
    if (brief.priorities?.includes("space") && isSliding(style)) score += 12;
    if (brief.priorities?.includes("ventilation")) score += movable * 3;

    return { style, score, percent, movable };
  });

  scored.sort((a, b) => b.score - a.score || a.style.panels - b.style.panels);

  const describe = (entry: typeof scored[number]): StyleMatch => {
    const bits: string[] = [];
    if (entry.movable === 0) bits.push("no abre, así que aprovecha todo el paño para luz y vista");
    else if (isSliding(entry.style)) bits.push(`${entry.movable} de sus ${entry.style.panels} hojas se deslizan sin invadir el interior`);
    else if (isHinged(entry.style)) bits.push(`abre sobre bisagras como una puerta tradicional`);
    if (entry.percent > 0) bits.push(`libera alrededor del ${entry.percent}% del ancho al abrir`);
    if (entry.style.estimated) bits.push("su precio es aproximado y lo confirma un asesor");
    return { style: entry.style, reason: bits.join(", "), openingPercent: entry.percent };
  };

  if (brief.leafCount && scored[0].style.panels !== brief.leafCount) {
    notes.push(`Pediste ${brief.leafCount} hojas, pero con ${(widthMm / 1000).toFixed(2)} m de ancho el catálogo no ofrece esa división en este producto; lo más cercano es ${scored[0].style.panels}.`);
  }

  return {
    best: describe(scored[0]),
    alternatives: scored.slice(1, 3).map(describe),
    widthMm,
    heightMm,
    notes,
  };
}
