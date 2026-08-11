// Estado estructurado acumulado de lo que el cliente le ha dicho a LUFT Asesor.
//
// POR QUÉ EXISTE: antes no había ninguno. El "contexto" del asistente se derivaba únicamente
// del estado del wizard (paso, estilo, medidas ya aplicadas), así que todo lo que el cliente
// contaba y todavía no era un campo del formulario -- "da al jardín", "quiero pasar", "que abra
// casi todo", "cuatro hojas" -- no tenía dónde vivir. Sobrevivía como texto en el historial y no
// podía influir en ninguna recomendación. De ahí las preguntas repetidas.
//
// REGLA CENTRAL (§170-171 del brief): cada mensaje produce un PATCH parcial. Un campo que el
// mensaje no menciona NO se toca. Nunca se sobrescribe un valor con null/undefined.
//
// Este módulo es deliberadamente puro: sin catálogos, sin precios, sin fetch. Por eso puede
// importarse tanto en el servidor (ruta del asistente) como en el navegador (respaldo del chat)
// sin arrastrar tarifas al bundle del cliente.

export type BriefProvenance = "confirmed" | "inferred";

/** Meta del vano y de la intención, acumulada a lo largo de la conversación. */
export type AssistantBrief = {
  widthMm?: number;
  heightMm?: number;
  /** Ubicación o destino mencionado: jardín, terraza, sala, cocina... */
  location?: string;
  /** true si el cliente necesita pasar por el vano. */
  accessRequired?: boolean;
  /** Qué prioriza al abrir. */
  openingGoal?: "maximum" | "view" | "balanced";
  leafCount?: number;
  /** Cuáles hojas se mueven, en lenguaje del cliente. */
  movingLeaves?: "center" | "left" | "right" | "all";
  /** Palabra de color tal como la dijo el cliente; se resuelve contra el catálogo aparte. */
  colorWord?: string;
  /** Prioridades detectadas: view, ventilation, minimal_frame, security, noise, budget, space. */
  priorities?: string[];
  /** De dónde salió cada campo. Una inferencia nunca se presenta como hecho (§19). */
  provenance?: Record<string, BriefProvenance>;
  /** Última configuración ya ofrecida ("estilo@ancho×alto"). Evita repetir la misma propuesta
   * turno tras turno, que es el ciclo conversacional que el brief prohíbe (§96). */
  offered?: string;
};

export type BriefPatch = Omit<AssistantBrief, "provenance">;

/** Aviso para el cliente cuando un valor parece un error de captura (§133). */
export type BriefWarning = { field: string; message: string };

export type BriefParseResult = {
  patch: BriefPatch;
  /** Campos que el mensaje mencionó explícitamente (para marcar procedencia). */
  confirmed: string[];
  /** Campos que se dedujeron y siguen necesitando confirmación. */
  inferred: string[];
  warnings: BriefWarning[];
};

const MAX_MM = 20_000;
const MIN_MM = 1;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ---------- Medidas ----------

const NUMBER_WORDS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};

// "cuatro y medio", "4 y medio", "cuatro cincuenta"
function wordsToNumber(raw: string): number | null {
  const text = normalize(raw).trim();
  const half = /\s+y\s+medio$/.test(text);
  const base = text.replace(/\s+y\s+medio$/, "").trim();
  const direct = Number(base.replace(",", "."));
  if (Number.isFinite(direct)) return half ? direct + 0.5 : direct;
  if (base in NUMBER_WORDS) return NUMBER_WORDS[base] + (half ? 0.5 : 0);
  // "cuatro cincuenta" = 4.50
  const pair = base.match(/^([a-z]+)\s+(cincuenta|veinte|treinta|cuarenta|sesenta|setenta|ochenta|noventa|diez)$/);
  if (pair && pair[1] in NUMBER_WORDS) {
    const decimals: Record<string, number> = { diez: 0.1, veinte: 0.2, treinta: 0.3, cuarenta: 0.4, cincuenta: 0.5, sesenta: 0.6, setenta: 0.7, ochenta: 0.8, noventa: 0.9 };
    return NUMBER_WORDS[pair[1]] + decimals[pair[2]];
  }
  return null;
}

type Unit = "m" | "cm" | "mm";

function canonicalUnit(raw: string | undefined): Unit | null {
  if (!raw) return null;
  const unit = normalize(raw).replace(/\./g, "");
  if (/^(m|mt|mts|mtr|mtrs|metro|metros)$/.test(unit)) return "m";
  if (/^(cm|centimetro|centimetros)$/.test(unit)) return "cm";
  if (/^(mm|milimetro|milimetros)$/.test(unit)) return "mm";
  return null;
}

// Sin unidad explícita, el orden de magnitud la delata: nadie pide una ventana de 4 mm ni de
// 4500 m. Mismo criterio que ya usaba el asistente, extraído aquí para poder probarlo.
function inferUnit(...values: number[]): Unit {
  const largest = Math.max(...values);
  if (largest <= 12) return "m";
  if (largest <= 500) return "cm";
  return "mm";
}

function toMm(amount: number, unit: Unit): number {
  if (unit === "m") return Math.round(amount * 1000);
  if (unit === "cm") return Math.round(amount * 10);
  return Math.round(amount);
}

function plausible(mm: number): boolean {
  return Number.isFinite(mm) && mm >= MIN_MM && mm <= MAX_MM;
}

// Alternancia de MÁS LARGO A MÁS CORTO a propósito: con "m" al principio, "4500 mm" consumía
// solo la primera m, dejaba la segunda sin casar y terminaba interpretando 4500 metros.
const UNIT_RE = "milimetros?|centimetros?|metros?|mtrs|mtr|mts|mm|cm|mt|m";
// Números en dígito o en palabra ("cuatro y medio", "cuatro cincuenta"): el cliente escribe de
// las dos formas. "uno"/"una" antes de "un" para que la alternancia no lo trunque.
const WORD_NUM = "cero|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce";
const DECIMAL_WORD = "diez|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa";
const NUM_RE = `(?:\\d+(?:[.,]\\d+)?|(?:${WORD_NUM})(?:\\s+(?:${DECIMAL_WORD}))?)(?:\\s+y\\s+medio)?`;

// Un valor con etiqueta explícita: "ancho 4.5", "4.5 de ancho", "el ancho es 4.20".
function labelledDimension(text: string, label: "ancho" | "alto"): { mm: number; raw: number; unit: Unit | null } | null {
  const alt = label === "alto" ? "(?:alto|altura|alta)" : "(?:ancho|anchura|ancha)";
  const patterns = [
    new RegExp(`${alt}\\s*(?:es|de|:|a)?\\s*(${NUM_RE})\\s*(${UNIT_RE})?`, "i"),
    new RegExp(`(${NUM_RE})\\s*(${UNIT_RE})?\\s*de\\s*${alt}`, "i"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const amount = wordsToNumber(match[1]);
    if (amount === null) continue;
    const unit = canonicalUnit(match[2]);
    return { mm: toMm(amount, unit ?? inferUnit(amount)), raw: amount, unit };
  }
  return null;
}

// Par "A x B" / "A por B". Sirve cuando no hay etiquetas y el orden es ancho × alto.
function dimensionPair(text: string): { widthMm: number; heightMm: number } | null {
  const pattern = new RegExp(`(${NUM_RE})\\s*(${UNIT_RE})?\\s*(?:x|×|por)\\s*(${NUM_RE})\\s*(${UNIT_RE})?`, "i");
  const match = text.match(pattern);
  if (!match) return null;
  const first = wordsToNumber(match[1]);
  const second = wordsToNumber(match[3]);
  if (first === null || second === null) return null;
  const firstUnit = canonicalUnit(match[2]);
  const secondUnit = canonicalUnit(match[4]);
  // Una sola unidad escrita se aplica a los dos números ("450 x 300 cm").
  const shared = firstUnit ?? secondUnit ?? inferUnit(first, second);
  return {
    widthMm: toMm(first, firstUnit ?? shared),
    heightMm: toMm(second, secondUnit ?? shared),
  };
}

/**
 * Lee las medidas del mensaje. Las etiquetas ganan sobre la posición: "3 de alto y 4.5 de ancho"
 * es 4500 × 3000, no 3000 × 4500 (§104). Un mensaje que solo corrige una dimensión devuelve solo
 * ese campo, para no arrastrar la otra (§269).
 */
export function parseDimensions(message: string): { patch: BriefPatch; confirmed: string[]; warnings: BriefWarning[] } {
  const text = normalize(message);
  const patch: BriefPatch = {};
  const confirmed: string[] = [];
  const warnings: BriefWarning[] = [];

  const width = labelledDimension(text, "ancho");
  const height = labelledDimension(text, "alto");

  if (width || height) {
    if (width) {
      if (plausible(width.mm)) { patch.widthMm = width.mm; confirmed.push("widthMm"); }
      else warnings.push(suspicious("widthMm", width.raw, width.unit));
    }
    if (height) {
      if (plausible(height.mm)) { patch.heightMm = height.mm; confirmed.push("heightMm"); }
      else warnings.push(suspicious("heightMm", height.raw, height.unit));
    }
    return { patch, confirmed, warnings };
  }

  const pair = dimensionPair(text);
  if (pair) {
    if (plausible(pair.widthMm) && plausible(pair.heightMm)) {
      patch.widthMm = pair.widthMm;
      patch.heightMm = pair.heightMm;
      confirmed.push("widthMm", "heightMm");
    } else {
      if (!plausible(pair.widthMm)) warnings.push(suspicious("widthMm", pair.widthMm, "mm"));
      if (!plausible(pair.heightMm)) warnings.push(suspicious("heightMm", pair.heightMm, "mm"));
    }
  }
  return { patch, confirmed, warnings };
}

function suspicious(field: string, raw: number, unit: Unit | null): BriefWarning {
  const side = field === "widthMm" ? "ancho" : "alto";
  return {
    field,
    message: `El ${side} de ${raw}${unit ? ` ${unit}` : ""} está fuera de lo fabricable. ¿Podrías confirmarlo en metros o centímetros?`,
  };
}

// ---------- Intención y preferencias ----------

const LOCATIONS: [RegExp, string][] = [
  [/\bjardin\b/, "jardín"],
  [/\bterraza\b/, "terraza"],
  [/\bbalcon\b/, "balcón"],
  [/\bpatio\b/, "patio"],
  [/\bsala\b/, "sala"],
  [/\bcocina\b/, "cocina"],
  [/\b(recamara|dormitorio|habitacion|cuarto)\b/, "recámara"],
  [/\bbano\b/, "baño"],
  [/\bfachada\b/, "fachada"],
  [/\balberca\b/, "alberca"],
];

const PRIORITY_RULES: [RegExp, string][] = [
  [/(mucha luz|mas luz|iluminacion|luminos|entre luz|clarid)/, "view"],
  [/(vista|panoram|ver el|no perder la vista|conservar la vista)/, "view"],
  [/(aire|ventil|se ventile|corriente)/, "ventilation"],
  [/(poco (marco|perfil)|menos (marco|perfil|division)|puro vidrio|minimalista|limpio|sin tantas division)/, "minimal_frame"],
  [/(segurid|antirrob|proteccion)/, "security"],
  [/(ruido|acustic|silencio)/, "noise"],
  [/(economic|barat|ahorrar|presupuesto|precio bajo)/, "budget"],
  [/(no (robe|quite|ocupe) espacio|ahorrar espacio|no choque|sin que estorbe)/, "space"],
];

// "cuatro hojas", "4 hojas", "de 2 hojas"
function parseLeafCount(text: string): number | null {
  const match = text.match(new RegExp(`(${NUM_RE}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho)\\s*(?:hojas?|panel(?:es)?|pano?s?)`, "i"));
  if (!match) return null;
  const amount = wordsToNumber(match[1]);
  if (amount === null || !Number.isInteger(amount) || amount < 1 || amount > 12) return null;
  return amount;
}

// La negación se evalúa sobre la vecindad inmediata del término, no sobre el mensaje entero:
// "no quiero negro, mejor blanco" debe descartar negro sin descartar blanco (§124).
function negatedNear(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 26), index);
  return /\b(no|nada de|sin|ya no|quita|quitar|nunca|menos)\b[^.,;]*$/.test(window);
}

const COLOR_WORDS = ["negro", "negra", "blanco", "blanca", "gris", "antracita", "marron", "café", "cafe", "nogal", "roble", "silver", "ceylon"];

function parseColorWord(text: string): string | null {
  for (const word of COLOR_WORDS) {
    const index = text.indexOf(word);
    if (index < 0) continue;
    if (negatedNear(text, index)) continue;
    return word;
  }
  return null;
}

/**
 * Convierte un mensaje en un patch parcial del brief. Solo devuelve los campos que el mensaje
 * realmente menciona: nunca campos vacíos que borrarían lo ya sabido.
 */
export function parseBriefPatch(message: string): BriefParseResult {
  const text = normalize(message);
  const dims = parseDimensions(message);
  const patch: BriefPatch = { ...dims.patch };
  const confirmed = [...dims.confirmed];
  const inferred: string[] = [];
  const warnings = [...dims.warnings];

  // Ubicación / destino
  for (const [pattern, name] of LOCATIONS) {
    if (pattern.test(text)) {
      patch.location = name;
      confirmed.push("location");
      break;
    }
  }

  // Necesidad de paso. Dicho explícitamente es confirmado; deducirlo de "da al jardín" es
  // inferencia y así se marca -- el brief no debe presentar una suposición como un hecho (§19).
  if (/\b(no|sin)\b[^.,;]*\b(pasar|acceso|entrar|salir)\b/.test(text) || /(solo|solamente|unicamente)\s+(ventana|iluminacion|luz)/.test(text)) {
    patch.accessRequired = false;
    confirmed.push("accessRequired");
  } else if (/(pasar|paso|acceso|entrar|salir|puerta|caminar|circular)/.test(text)) {
    patch.accessRequired = true;
    confirmed.push("accessRequired");
  } else if (patch.location && /(jardin|terraza|balcon|patio|alberca)/.test(normalize(patch.location))) {
    patch.accessRequired = true;
    inferred.push("accessRequired");
  }

  // Objetivo de apertura
  if (/(abr(a|ir|e)\s+(casi\s+)?todo|maxima apertura|lo mas abierto|liberar? (todo|la mayor)|mayor apertura|se escondan|abra la mayor)/.test(text)) {
    patch.openingGoal = "maximum";
    confirmed.push("openingGoal");
  } else if (/(no necesito abrir|que no abra|solo (luz|vista|iluminacion)|fijo)/.test(text)) {
    patch.openingGoal = "view";
    confirmed.push("openingGoal");
  } else if (/(equilibr|mitad|punto medio|balance)/.test(text)) {
    patch.openingGoal = "balanced";
    confirmed.push("openingGoal");
  }

  const leafCount = parseLeafCount(text);
  if (leafCount !== null) {
    patch.leafCount = leafCount;
    confirmed.push("leafCount");
  }

  if (/(dos del? (centro|medio)|centrales|del centro|de en medio)/.test(text)) {
    patch.movingLeaves = "center";
    confirmed.push("movingLeaves");
  } else if (/todas.*(izquierda)/.test(text)) {
    patch.movingLeaves = "left";
    confirmed.push("movingLeaves");
  } else if (/todas.*(derecha)/.test(text)) {
    patch.movingLeaves = "right";
    confirmed.push("movingLeaves");
  }

  const colorWord = parseColorWord(text);
  if (colorWord) {
    patch.colorWord = colorWord;
    confirmed.push("colorWord");
  }

  const priorities: string[] = [];
  for (const [pattern, name] of PRIORITY_RULES) {
    if (pattern.test(text) && !priorities.includes(name)) priorities.push(name);
  }
  if (priorities.length) {
    patch.priorities = priorities;
    confirmed.push("priorities");
  }

  return { patch, confirmed, inferred, warnings };
}

/**
 * Fusiona el patch sobre el brief sin destruir nada. Un campo ausente del patch se conserva;
 * `undefined` nunca sobrescribe un valor existente. Las prioridades se acumulan en vez de
 * reemplazarse, porque el cliente las va revelando a lo largo de la conversación.
 */
export function applyBriefPatch(brief: AssistantBrief, result: BriefParseResult): AssistantBrief {
  const next: AssistantBrief = { ...brief };
  const provenance = { ...(brief.provenance ?? {}) };

  for (const [key, value] of Object.entries(result.patch) as [keyof BriefPatch, unknown][]) {
    if (value === undefined || value === null) continue;
    if (key === "priorities") {
      const merged = [...(brief.priorities ?? [])];
      for (const item of value as string[]) if (!merged.includes(item)) merged.push(item);
      next.priorities = merged;
      continue;
    }
    // Una inferencia no pisa un dato que el cliente ya confirmó (§168-169).
    if (result.inferred.includes(key) && provenance[key] === "confirmed") continue;
    (next as Record<string, unknown>)[key] = value;
  }

  for (const key of result.confirmed) provenance[key] = "confirmed";
  for (const key of result.inferred) if (!provenance[key]) provenance[key] = "inferred";
  next.provenance = provenance;
  return next;
}

// ---------- Lectura del brief ----------

export function briefAreaM2(brief: AssistantBrief): number | null {
  if (!brief.widthMm || !brief.heightMm) return null;
  return Math.round((brief.widthMm / 1000) * (brief.heightMm / 1000) * 10) / 10;
}

function meters(mm: number): string {
  return (mm / 1000).toFixed(2).replace(/\.00$/, ".00");
}

/** Resumen para "¿qué llevamos?" (§145). Solo lo que realmente se sabe. */
export function briefSummary(brief: AssistantBrief): string[] {
  const lines: string[] = [];
  if (brief.widthMm && brief.heightMm) {
    const area = briefAreaM2(brief);
    lines.push(`Vano de ${meters(brief.widthMm)} × ${meters(brief.heightMm)} m${area ? ` (≈ ${area} m²)` : ""}`);
  } else if (brief.widthMm) lines.push(`Ancho de ${meters(brief.widthMm)} m`);
  else if (brief.heightMm) lines.push(`Alto de ${meters(brief.heightMm)} m`);

  if (brief.location) lines.push(`Da a ${brief.location}`);
  if (brief.accessRequired === true) lines.push(brief.provenance?.accessRequired === "inferred" ? "Probablemente se usa para pasar (por confirmar)" : "Se usa para pasar");
  if (brief.accessRequired === false) lines.push("Solo ventana, sin paso");
  if (brief.openingGoal === "maximum") lines.push("Prioridad: abrir lo más posible");
  if (brief.openingGoal === "view") lines.push("Prioridad: vista e iluminación");
  if (brief.openingGoal === "balanced") lines.push("Prioridad: equilibrio entre vista y apertura");
  if (brief.leafCount) lines.push(`${brief.leafCount} hojas`);
  if (brief.movingLeaves === "center") lines.push("Hojas centrales móviles");
  if (brief.movingLeaves === "left") lines.push("Hojas corren a la izquierda");
  if (brief.movingLeaves === "right") lines.push("Hojas corren a la derecha");
  if (brief.colorWord) lines.push(`Color: ${brief.colorWord}`);
  return lines;
}

/**
 * Respuesta que demuestra comprensión: repite las medidas reales, calcula el área y plantea las
 * salidas posibles según lo que ya se sabe (§30, §265). Sustituye a la plantilla fija por paso,
 * que era la que ignoraba los datos del cliente.
 *
 * Solo describe enfoques, nunca sistemas ni precios concretos: eso lo resuelve el catálogo y el
 * motor. Es el nivel 1 "propuesta conceptual" del brief (§24).
 */
export function briefRecommendation(brief: AssistantBrief): string | null {
  if (!brief.widthMm || !brief.heightMm) return null;
  const area = briefAreaM2(brief);
  const size = `${meters(brief.widthMm)} m de ancho por ${meters(brief.heightMm)} m de alto`;
  const scale = (brief.widthMm >= 3000 || (area ?? 0) >= 8) ? "es un vano grande" : "es un vano de buen tamaño";
  const opening = [`Tienes ${size}${area ? `, alrededor de ${area} m²` : ""}: ${scale}.`];

  if (brief.accessRequired === true && brief.openingGoal === "maximum") {
    opening.push(
      `Como lo vas a usar para pasar${brief.location ? ` hacia ${brief.location}` : ""} y quieres liberar la mayor parte al abrir, conviene repartir el ancho en varias hojas móviles en lugar de una pieza grande: así el peso y la operación se mantienen razonables.`,
    );
  } else if (brief.accessRequired === true) {
    opening.push(
      `Como necesitas pasar${brief.location ? ` hacia ${brief.location}` : ""}, lo trataría como un acceso amplio. Se puede resolver con varias hojas que se deslicen, o combinando paños fijos con hojas móviles si prefieres conservar más vista.`,
    );
  } else if (brief.accessRequired === false) {
    opening.push(
      "Como será solo ventana, podemos reducir divisiones y aprovechar paños más grandes para ganar luz y vista, o sumar hojas móviles si te interesa más la ventilación.",
    );
  } else {
    opening.push(
      "Ahí caben soluciones distintas: si necesitas pasar, conviene repartir el ancho en varias hojas; si buscas sobre todo vista e iluminación, se pueden usar paños más grandes con menos divisiones.",
    );
  }

  if (brief.priorities?.includes("minimal_frame") && brief.openingGoal === "maximum") {
    opening.push("Ten en cuenta que abrir más suele pedir más hojas, y más hojas significa más divisiones a la vista: buscaría un punto medio entre esas dos prioridades.");
  }
  return opening.join(" ");
}

/**
 * El dato desconocido que más reduce la incertidumbre (§192). El orden sigue la prioridad del
 * brief (§46): primero la función del vano, luego las medidas, luego la forma de abrir.
 */
export function nextBriefQuestion(brief: AssistantBrief): { field: string; question: string } | null {
  if (!brief.widthMm && !brief.heightMm) {
    return { field: "dimensions", question: "¿De qué medida es el espacio? Con el ancho y el alto aproximados puedo proponerte opciones concretas." };
  }
  if (!brief.widthMm) return { field: "widthMm", question: "¿Cuánto mide de ancho el vano?" };
  if (!brief.heightMm) return { field: "heightMm", question: "¿Cuánto mide de alto el vano?" };
  if (brief.accessRequired === undefined) {
    return { field: "accessRequired", question: "¿Necesitas poder pasar por ahí, por ejemplo hacia un jardín o una terraza, o funcionará solo como ventana?" };
  }
  if (brief.provenance?.accessRequired === "inferred") {
    return { field: "accessRequired", question: `Como da a ${brief.location ?? "ese espacio"}, imagino que también lo usarás para pasar. ¿Es correcto?` };
  }
  if (brief.openingGoal === undefined) {
    return brief.accessRequired
      ? { field: "openingGoal", question: "¿Quieres que al abrir quede libre la mayor parte posible del vano o te parece bien conservar algunos paños fijos?" }
      : { field: "openingGoal", question: "¿Prefieres priorizar la vista con menos divisiones o tener más hojas que abran para ventilar?" };
  }
  return null;
}
