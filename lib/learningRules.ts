/**
 * Las reglas de la mejora continua para cotizar: qué se puede registrar, cómo se resumen los datos y
 * qué se recomienda con ellos. TODO aquí es puro -- ni base de datos, ni red, ni estado.
 *
 * Está separado de lib/learning.ts (que sí consulta la base) por dos razones. La primera es que este
 * archivo lo importa el editor, que corre en el navegador: si las reglas vivieran junto a las
 * consultas, el navegador acabaría descargando drizzle y el esquema de la base para poder mostrar una
 * sugerencia. La segunda es que así estas reglas se prueban enteras sin base de datos ni navegador
 * (ver tests/learning.test.ts), que es lo que permite afirmar que no proponen tocar un precio.
 *
 * Tres decisiones definen la capa entera, y las tres son restricciones antes que funciones:
 *
 *   1. NO HAY DATOS PERSONALES. Ni nombre, ni teléfono, ni correo, ni dirección, ni id de proyecto o
 *      de componente por el que se pudiera llegar a ellos. Solo qué tipología, qué sistema, qué
 *      medidas y qué importes. El filtro de abajo (`sanitizeEvent`) es una lista de campos
 *      PERMITIDOS: un campo nuevo no entra por descuido, hay que agregarlo a mano.
 *   2. NADA SE APLICA SOLO. Este módulo devuelve recomendaciones con su sustento; quien decide es
 *      quien cotiza. No hay ninguna función aquí que cambie un precio, un margen o un componente.
 *   3. SE DICE CUÁNDO NO SE SABE. Cada recomendación lleva el tamaño de muestra que la respalda y
 *      un nivel de confianza derivado de él. Con pocos datos la recomendación sale marcada como
 *      poco confiable en vez de callarse el dato o disfrazarlo de certeza.
 *
 * Comparar costo real contra estimado y lo cotizado contra lo fabricado SÍ se hace, y con datos
 * capturados: salen del cierre de obra (ver la tabla project_outcomes y la ruta .../outcome), que
 * alguien llena al terminar. No se infieren de la configuración porque no se pueden inferir. Mientras
 * no haya obras cerradas, esas cifras se muestran vacías -- "todavía no lo sé" -- y ninguna
 * recomendación se apoya en ellas.
 */

/** Tipos de evento aceptados. Cualquier otro se rechaza al registrarse. */
export const LEARNING_EVENT_KINDS = [
  "componente_guardado",
  "componente_duplicado",
  "proyecto_creado",
  "proyecto_exportado",
  "cotizacion_resuelta",
  "obra_cerrada",
] as const;

export type LearningEventKind = (typeof LEARNING_EVENT_KINDS)[number];

export function isLearningEventKind(value: unknown): value is LearningEventKind {
  return typeof value === "string" && (LEARNING_EVENT_KINDS as readonly string[]).includes(value);
}

/**
 * Campos permitidos por tipo de evento, con su tipo esperado.
 *
 * Es una lista blanca y no una lista negra a propósito: con una lista negra, el día que alguien
 * agregue `clientEmail` al componente y lo pase de más a esta función, el correo del cliente
 * terminaría escrito en la tabla de estadísticas. Así, no entra.
 */
const ALLOWED_FIELDS: Record<LearningEventKind, Record<string, "string" | "number" | "boolean">> = {
  componente_guardado: {
    typology: "string",
    brand: "string",
    systemName: "string",
    glassName: "string",
    colorName: "string",
    hardware: "string",
    widthMm: "number",
    heightMm: "number",
    qty: "number",
    leafCount: "number",
    railCount: "number",
    marginPct: "number",
    discountPct: "number",
    unitPrice: "number",
    total: "number",
    configState: "string",
    /** Segundos entre abrir el componente y guardarlo: el "tiempo utilizado para cotizar". */
    editSeconds: "number",
    /** Cuántas veces se corrigió una medida antes de guardar (señal de correcciones frecuentes). */
    dimensionEdits: "number",
  },
  componente_duplicado: { typology: "string", brand: "string", systemName: "string" },
  proyecto_creado: { currency: "string", origin: "string" },
  proyecto_exportado: { componentCount: "number" },
  cotizacion_resuelta: {
    outcome: "string",
    reason: "string",
    total: "number",
  },
  // Del cierre de obra solo entran DESVIACIONES en porcentaje. Ni el costo real, ni lo cobrado, ni el
  // proyecto: los importes de una obra concreta son dato del cliente, y el porcentaje de desvío no.
  obra_cerrada: {
    costDeviationPct: "number",
    realMarginPct: "number",
    piecesDeviationPct: "number",
  },
};

const MAX_STRING = 120;

/** Aplica la lista blanca. Devuelve solo lo permitido, con el tipo correcto y acotado. */
export function sanitizeEvent(kind: LearningEventKind, payload: unknown): Record<string, string | number | boolean> {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  const allowed = ALLOWED_FIELDS[kind];
  const clean: Record<string, string | number | boolean> = {};
  for (const [field, type] of Object.entries(allowed)) {
    const value = source[field];
    if (type === "string" && typeof value === "string" && value) clean[field] = value.slice(0, MAX_STRING);
    if (type === "number" && typeof value === "number" && Number.isFinite(value)) clean[field] = value;
    if (type === "boolean" && typeof value === "boolean") clean[field] = value;
  }
  return clean;
}


// ---------- Estadísticas ----------

export type Counter = { value: string; count: number };

/** Resumen de una serie de números. La mediana y los percentiles, y no el promedio solo, porque una
 *  ventana de 12 metros en el histórico movería el promedio de "medida habitual" a un valor que
 *  nadie cotiza nunca. */
export type Distribution = {
  count: number;
  min: number;
  p10: number;
  median: number;
  p90: number;
  max: number;
  mean: number;
};

export type TypologyStats = {
  count: number;
  widthMm: Distribution;
  heightMm: Distribution;
  systems: Counter[];
  glasses: Counter[];
  colors: Counter[];
};

export type LearningStats = {
  /** Cuántos componentes guardados respaldan las estadísticas. Es el número que decide la confianza. */
  sampleSize: number;
  totalEvents: number;
  since: string | null;
  typologies: Counter[];
  systems: Counter[];
  glasses: Counter[];
  colors: Counter[];
  hardware: Counter[];
  byTypology: Record<string, TypologyStats>;
  widthMm: Distribution;
  heightMm: Distribution;
  qty: Distribution;
  marginPct: Distribution;
  discountPct: Distribution;
  editSeconds: Distribution;
  duplicates: number;
  outcomes: { accepted: number; rejected: number; reasons: Counter[] };
  /** De los cierres de obra: cuánto se desvía el costo real del estimado, qué margen real queda y
   *  cuánto se desvía lo fabricado de lo cotizado. Vacías mientras nadie cierre una obra, y eso es lo
   *  que se muestra -- "todavía no lo sé" y no una estimación inventada. */
  closedProjects: number;
  costDeviationPct: Distribution;
  realMarginPct: Distribution;
  piecesDeviationPct: Distribution;
};

function emptyDistribution(): Distribution {
  return { count: 0, min: 0, p10: 0, median: 0, p90: 0, max: 0, mean: 0 };
}

/** Estadísticas vacías. Las usa la interfaz cuando el registro está apagado o el historial no ha
 *  cargado, para poder evaluar igual las reglas que solo miran el proyecto abierto (campos sin
 *  llenar, componentes repetidos) sin tener que duplicar esta forma en el componente. */
export function emptyLearningStats(): LearningStats {
  return {
    sampleSize: 0,
    totalEvents: 0,
    since: null,
    typologies: [],
    systems: [],
    glasses: [],
    colors: [],
    hardware: [],
    byTypology: {},
    widthMm: emptyDistribution(),
    heightMm: emptyDistribution(),
    qty: emptyDistribution(),
    marginPct: emptyDistribution(),
    discountPct: emptyDistribution(),
    editSeconds: emptyDistribution(),
    duplicates: 0,
    outcomes: { accepted: 0, rejected: 0, reasons: [] },
    closedProjects: 0,
    costDeviationPct: emptyDistribution(),
    realMarginPct: emptyDistribution(),
    piecesDeviationPct: emptyDistribution(),
  };
}

export function distribution(values: number[]): Distribution {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return emptyDistribution();
  const at = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))))];
  return {
    count: sorted.length,
    min: sorted[0],
    p10: at(0.1),
    median: at(0.5),
    p90: at(0.9),
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((total, value) => total + value, 0) / sorted.length,
  };
}

function countBy(values: (string | undefined)[]): Counter[] {
  const tally = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    tally.set(value, (tally.get(value) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

type RawEvent = { kind: string; payload: Record<string, unknown>; createdAt: number };

/** Construye las estadísticas a partir de los eventos ya leídos. Separado de la consulta para poder
 *  probarlo sin base de datos. */
export function summarize(events: RawEvent[]): LearningStats {
  const saves = events.filter((event) => event.kind === "componente_guardado");
  const num = (event: RawEvent, field: string) => (typeof event.payload[field] === "number" ? (event.payload[field] as number) : NaN);
  const text = (event: RawEvent, field: string) => (typeof event.payload[field] === "string" ? (event.payload[field] as string) : undefined);

  const byTypology: Record<string, TypologyStats> = {};
  for (const typology of new Set(saves.map((event) => text(event, "typology")).filter((value): value is string => !!value))) {
    const group = saves.filter((event) => text(event, "typology") === typology);
    byTypology[typology] = {
      count: group.length,
      widthMm: distribution(group.map((event) => num(event, "widthMm"))),
      heightMm: distribution(group.map((event) => num(event, "heightMm"))),
      systems: countBy(group.map((event) => text(event, "systemName"))),
      glasses: countBy(group.map((event) => text(event, "glassName"))),
      colors: countBy(group.map((event) => text(event, "colorName"))),
    };
  }

  const resolved = events.filter((event) => event.kind === "cotizacion_resuelta");
  const closed = events.filter((event) => event.kind === "obra_cerrada");
  const oldest = events.reduce((min, event) => Math.min(min, event.createdAt), Number.POSITIVE_INFINITY);

  return {
    sampleSize: saves.length,
    totalEvents: events.length,
    since: Number.isFinite(oldest) ? new Date(oldest).toISOString() : null,
    typologies: countBy(saves.map((event) => text(event, "typology"))),
    systems: countBy(saves.map((event) => text(event, "systemName"))),
    glasses: countBy(saves.map((event) => text(event, "glassName"))),
    colors: countBy(saves.map((event) => text(event, "colorName"))),
    hardware: countBy(saves.map((event) => text(event, "hardware"))),
    byTypology,
    widthMm: distribution(saves.map((event) => num(event, "widthMm"))),
    heightMm: distribution(saves.map((event) => num(event, "heightMm"))),
    qty: distribution(saves.map((event) => num(event, "qty"))),
    marginPct: distribution(saves.map((event) => num(event, "marginPct"))),
    discountPct: distribution(saves.map((event) => num(event, "discountPct"))),
    editSeconds: distribution(saves.map((event) => num(event, "editSeconds"))),
    duplicates: events.filter((event) => event.kind === "componente_duplicado").length,
    outcomes: {
      accepted: resolved.filter((event) => text(event, "outcome") === "aceptada").length,
      rejected: resolved.filter((event) => text(event, "outcome") === "rechazada").length,
      reasons: countBy(resolved.filter((event) => text(event, "outcome") === "rechazada").map((event) => text(event, "reason"))),
    },
    closedProjects: closed.length,
    costDeviationPct: distribution(closed.map((event) => num(event, "costDeviationPct"))),
    realMarginPct: distribution(closed.map((event) => num(event, "realMarginPct"))),
    piecesDeviationPct: distribution(closed.map((event) => num(event, "piecesDeviationPct"))),
  };
}


// ---------- Recomendaciones ----------

export type RecommendationConfidence = "alta" | "media" | "baja";

export type Recommendation = {
  id: string;
  /** "sugerencia" propone un valor; "aviso" señala algo raro; "faltante" pide un dato sin llenar. */
  kind: "sugerencia" | "aviso" | "faltante";
  title: string;
  detail: string;
  /** En qué datos se apoya, tal cual para mostrarlo. Es lo que hace la recomendación explicable. */
  basis: string;
  confidence: RecommendationConfidence;
  sampleSize: number;
  /** El cambio propuesto, si es aplicable de un clic. La interfaz decide cómo aplicarlo; este
   *  módulo nunca lo aplica. Ausente en avisos y faltantes, que no proponen ningún valor. */
  suggestion?: { field: "glassName" | "systemName" | "marginPct" | "typology" | "qty"; value: string | number };
};

/** Lo que se está cotizando ahora, para poder comparar contra el histórico. */
export type RecommendationContext = {
  typology: string;
  systemName: string;
  glassName: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  marginPct: number;
  discountPct: number;
  /** Datos del proyecto que la interfaz ya conoce, para las recomendaciones de "campos incompletos". */
  hasClientName: boolean;
  hasClientContact: boolean;
  hasLocation: boolean;
  /** Componentes del proyecto que coinciden en tipología, medidas y sistema con el actual. */
  identicalSiblings: number;
};

/** Muestra mínima para que una frecuencia signifique algo. Por debajo, la recomendación se emite
 *  igual pero marcada como poco confiable: ocultarla sería decidir por quien cotiza. */
const MIN_SAMPLE = 3;
const CONFIDENT_SAMPLE = 12;
/** Cuota que una opción debe alcanzar para considerarse "la habitual". */
const DOMINANT_SHARE = 0.5;

function confidenceFor(sampleSize: number): RecommendationConfidence {
  if (sampleSize >= CONFIDENT_SAMPLE) return "alta";
  if (sampleSize >= MIN_SAMPLE) return "media";
  return "baja";
}

function share(counters: Counter[], total: number): { top: Counter; share: number } | null {
  const top = counters[0];
  if (!top || total === 0) return null;
  return { top, share: top.count / total };
}

/**
 * Construye las recomendaciones. Función pura: mismas estadísticas y mismo contexto, mismas
 * recomendaciones. No consulta la base ni escribe nada, y por eso se puede probar entera.
 */
export function buildRecommendations(stats: LearningStats, context: RecommendationContext): Recommendation[] {
  const out: Recommendation[] = [];

  // --- Faltantes. Son reglas, no estadística: no dependen del histórico y por eso su confianza es
  // siempre alta -- que un campo esté vacío es un hecho, no una inferencia.
  if (!context.hasClientName) {
    out.push({
      id: "falta-solicitante",
      kind: "faltante",
      title: "El proyecto no tiene solicitante",
      detail: "La cotización sale sin nombre de cliente. Captúralo en la ficha del solicitante.",
      basis: "Revisión del proyecto abierto.",
      confidence: "alta",
      sampleSize: 0,
    });
  }
  if (context.hasClientName && !context.hasClientContact) {
    out.push({
      id: "falta-contacto",
      kind: "faltante",
      title: "El solicitante no tiene teléfono ni correo",
      detail: "Sin un medio de contacto no hay forma de dar seguimiento a la cotización.",
      basis: "Revisión del proyecto abierto.",
      confidence: "alta",
      sampleSize: 0,
    });
  }
  if (!context.hasLocation) {
    out.push({
      id: "falta-ubicacion",
      kind: "faltante",
      title: "El componente no tiene ubicación",
      detail: "La ubicación (cocina, recámara, fachada) es lo que permite identificar cada ventana en obra.",
      basis: "Revisión del componente abierto.",
      confidence: "alta",
      sampleSize: 0,
    });
  }

  // --- Componentes repetidos en el mismo proyecto. También es un hecho comprobable, no una
  // inferencia del histórico.
  if (context.identicalSiblings > 0) {
    out.push({
      id: "componentes-repetidos",
      kind: "aviso",
      title: `Hay ${context.identicalSiblings} componente(s) idéntico(s) en este proyecto`,
      detail:
        "Misma tipología, mismas medidas y mismo sistema. Si son la misma ventana repetida, conviene una sola partida con la cantidad correcta en vez de varias iguales.",
      basis: "Comparación con los demás componentes del proyecto abierto.",
      confidence: "alta",
      sampleSize: 0,
      suggestion: { field: "qty", value: context.identicalSiblings + context.qty },
    });
  }

  // --- Reglas que se apoyan en las OBRAS CERRADAS. Van antes del corte de abajo a propósito: no
  // dependen de cuántos componentes se hayan guardado, sino de cuántas obras se hayan cerrado, y son
  // dos muestras distintas. Con el registro activado a mitad del año puede haber cierres capturados
  // sin apenas historial de componentes, y ese aviso sigue siendo válido.
  // --- Costo real frente al estimado. Sale de las obras cerradas, no de una estimación: si el costo
  // real ha venido quedando sistemáticamente por encima de lo cotizado, cotizar al costo estimado a
  // secas deja el margen por debajo del que se cree. Se avisa con la desviación mediana medida y NO se
  // toca el precio: subirlo solo sería exactamente lo que §9 prohíbe.
  if (stats.costDeviationPct.count >= MIN_SAMPLE && Math.abs(stats.costDeviationPct.median) >= 5) {
    const median = Math.round(stats.costDeviationPct.median * 10) / 10;
    const above = median > 0;
    out.push({
      id: "desvio-costo-real",
      kind: "aviso",
      title: `Tus costos reales terminan ${Math.abs(median)}% ${above ? "por encima" : "por debajo"} de lo estimado`,
      detail: above
        ? `En las obras que has cerrado, el costo real quedó ${Math.abs(median)}% arriba del cotizado (de ${Math.round(stats.costDeviationPct.p10)}% a ${Math.round(stats.costDeviationPct.p90)}%). Vale revisar si esta cotización absorbe esa diferencia.`
        : `En las obras que has cerrado, el costo real quedó ${Math.abs(median)}% abajo del cotizado. Puede haber margen de sobra respecto a lo que supone la cotización.`,
      basis: `${stats.costDeviationPct.count} obra(s) cerrada(s) con costo real capturado.`,
      confidence: confidenceFor(stats.costDeviationPct.count),
      sampleSize: stats.costDeviationPct.count,
    });
  }

  // --- Lo fabricado frente a lo cotizado. Una desviación persistente en piezas no es un problema de
  // fabricación sino de cómo se está midiendo o cotizando la obra.
  if (stats.piecesDeviationPct.count >= MIN_SAMPLE && Math.abs(stats.piecesDeviationPct.median) >= 5) {
    const median = Math.round(stats.piecesDeviationPct.median * 10) / 10;
    out.push({
      id: "desvio-piezas-fabricadas",
      kind: "aviso",
      title: `Se fabrica ${Math.abs(median)}% ${median > 0 ? "más" : "menos"} de lo que se cotiza`,
      detail: `En las obras cerradas, las piezas fabricadas se desviaron una mediana de ${median}% respecto a las cotizadas. Conviene revisar el conteo de piezas de este proyecto antes de entregarlo.`,
      basis: `${stats.piecesDeviationPct.count} obra(s) cerrada(s) con piezas fabricadas capturadas.`,
      confidence: confidenceFor(stats.piecesDeviationPct.count),
      sampleSize: stats.piecesDeviationPct.count,
    });
  }


  // A partir de aquí todo depende del histórico de componentes guardados. Sin histórico no hay nada
  // que decir, y decirlo es mejor que inventar una recomendación.
  if (stats.sampleSize === 0) return out;

  // Sustento general, para las reglas que se apoyan en todo el histórico y no en un subconjunto. Las
  // que sí tienen su propio subconjunto (una tipología, un campo concreto) declaran el suyo y su
  // propia confianza, calculada sobre ESA muestra y no sobre el total.
  const basis = `${stats.sampleSize} componente(s) guardado(s)${stats.since ? ` desde ${new Date(stats.since).toLocaleDateString("es-MX")}` : ""}.`;

  // --- Vidrio habitual para este sistema.
  const typologyStats = stats.byTypology[context.typology];
  const glassPool = typologyStats?.glasses ?? stats.glasses;
  const glassTotal = typologyStats?.count ?? stats.sampleSize;
  const topGlass = share(glassPool, glassTotal);
  if (topGlass && topGlass.share >= DOMINANT_SHARE && context.glassName && topGlass.top.value !== context.glassName) {
    out.push({
      id: "vidrio-habitual",
      kind: "sugerencia",
      title: `El vidrio que casi siempre usas aquí es ${topGlass.top.value}`,
      detail: `Este componente lleva ${context.glassName}. En ${Math.round(topGlass.share * 100)}% de los casos parecidos se usó ${topGlass.top.value}.`,
      basis: typologyStats
        ? `${typologyStats.count} componente(s) con tipología "${context.typology}".`
        : basis,
      confidence: confidenceFor(glassTotal),
      sampleSize: glassTotal,
      suggestion: { field: "glassName", value: topGlass.top.value },
    });
  }

  // --- Medida inusual. Se compara contra el rango habitual de la misma tipología, no contra el
  // general: una corrediza de 4 m es normal y una abatible de 4 m no.
  const dimensionSource = typologyStats ?? { widthMm: stats.widthMm, heightMm: stats.heightMm, count: stats.sampleSize };
  for (const [label, value, spread] of [
    ["ancho", context.widthMm, dimensionSource.widthMm],
    ["alto", context.heightMm, dimensionSource.heightMm],
  ] as const) {
    if (spread.count < MIN_SAMPLE) continue;
    if (value < spread.p10 || value > spread.p90) {
      out.push({
        id: `medida-inusual-${label}`,
        kind: "aviso",
        title: `El ${label} de ${Math.round(value)} mm se sale de lo habitual`,
        detail: `En proyectos anteriores el ${label} de esta tipología va de ${Math.round(spread.p10)} a ${Math.round(spread.p90)} mm (mediana ${Math.round(spread.median)} mm). Puede estar bien; conviene confirmarlo antes de cotizar.`,
        basis: `${spread.count} medida(s) registrada(s).`,
        confidence: confidenceFor(spread.count),
        sampleSize: spread.count,
      });
    }
  }

  // --- Margen fuera de lo habitual. Se AVISA, nunca se cambia: el margen es una decisión
  // comercial, y §9 es explícito en que no se toquen precios ni márgenes en silencio.
  if (stats.marginPct.count >= MIN_SAMPLE && Math.abs(context.marginPct - stats.marginPct.median) >= 8) {
    const direction = context.marginPct < stats.marginPct.median ? "por debajo" : "por encima";
    out.push({
      id: "margen-inusual",
      kind: "aviso",
      title: `El margen de ${context.marginPct}% está ${direction} de tu margen habitual`,
      detail: `Tu mediana es ${Math.round(stats.marginPct.median)}% (de ${Math.round(stats.marginPct.p10)}% a ${Math.round(stats.marginPct.p90)}%). Revisa si es intencional.`,
      basis: `${stats.marginPct.count} cotización(es) con margen registrado.`,
      confidence: confidenceFor(stats.marginPct.count),
      sampleSize: stats.marginPct.count,
    });
  }

  // --- Descuento por encima de lo que se acostumbra.
  if (stats.discountPct.count >= MIN_SAMPLE && context.discountPct > stats.discountPct.p90 && context.discountPct > 0) {
    out.push({
      id: "descuento-inusual",
      kind: "aviso",
      title: `El descuento de ${context.discountPct}% es más alto de lo habitual`,
      detail: `El 90% de tus cotizaciones anteriores quedó en ${Math.round(stats.discountPct.p90)}% o menos.`,
      basis: `${stats.discountPct.count} cotización(es) con descuento registrado.`,
      confidence: confidenceFor(stats.discountPct.count),
      sampleSize: stats.discountPct.count,
    });
  }

  // --- Cantidad sospechosa. Un cero de más en la cantidad multiplica el importe por diez, y es el
  // error de captura más caro que se puede cometer aquí.
  if (stats.qty.count >= MIN_SAMPLE && context.qty > Math.max(10, stats.qty.p90 * 5)) {
    out.push({
      id: "cantidad-sospechosa",
      kind: "aviso",
      title: `¿La cantidad de ${context.qty} piezas es correcta?`,
      detail: `Es mucho más de lo habitual: el 90% de tus componentes va hasta ${Math.round(stats.qty.p90)} pieza(s).`,
      basis: `${stats.qty.count} componente(s) con cantidad registrada.`,
      confidence: confidenceFor(stats.qty.count),
      sampleSize: stats.qty.count,
    });
  }

  // --- Motivo de rechazo recurrente. Solo si hay cotizaciones resueltas de verdad.
  const topReason = stats.outcomes.reasons[0];
  const resolvedTotal = stats.outcomes.accepted + stats.outcomes.rejected;
  if (topReason && resolvedTotal >= MIN_SAMPLE) {
    out.push({
      id: "motivo-rechazo",
      kind: "aviso",
      title: `El motivo de rechazo más frecuente es "${topReason.value}"`,
      detail: `De ${resolvedTotal} cotización(es) resuelta(s), ${stats.outcomes.rejected} se rechazaron y ${topReason.count} por este motivo.`,
      basis: `${resolvedTotal} cotización(es) con resultado registrado.`,
      confidence: confidenceFor(resolvedTotal),
      sampleSize: resolvedTotal,
    });
  }

  return out;
}

/** Plantillas: las configuraciones que más se repiten, para arrancar un componente nuevo desde algo
 *  ya usado en vez de desde la ventana genérica. Se devuelven ordenadas por frecuencia y solo las
 *  que se repitieron al menos dos veces -- una configuración usada una vez no es una plantilla. */
export type QuoteTemplate = {
  typology: string;
  systemName: string;
  glassName: string;
  widthMm: number;
  heightMm: number;
  timesUsed: number;
};

export function buildTemplates(stats: LearningStats, limit = 5): QuoteTemplate[] {
  return Object.entries(stats.byTypology)
    .filter(([, group]) => group.count >= 2)
    .map(([typology, group]) => ({
      typology,
      systemName: group.systems[0]?.value ?? "",
      glassName: group.glasses[0]?.value ?? "",
      // La mediana y no el último valor: la plantilla debe ser la medida representativa, no la de
      // la última ventana que se cotizó.
      widthMm: Math.round(group.widthMm.median),
      heightMm: Math.round(group.heightMm.median),
      timesUsed: group.count,
    }))
    .sort((a, b) => b.timesUsed - a.timesUsed)
    .slice(0, limit);
}
