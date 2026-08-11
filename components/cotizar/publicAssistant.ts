import type { PublicCatalog } from "@/lib/publicCatalog";
import { briefRecommendation, briefSummary, nextBriefQuestion, type AssistantBrief } from "@/lib/assistantBrief";

export type PublicAssistantContext = {
  step: number;
  stepName: string;
  productId: string;
  brandId: string;
  styleId: string;
  colorId: string;
  glassId: string;
  productName: string;
  brandName: string;
  styleName: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  colorName: string;
  glassName: string;
  installation: boolean;
  sizeError: string;
  total: number | null;
  estimated: boolean;
  designCount: number;
  folio: string;
  minMm: number;
  styleMaxW: number | null;
  styleMaxH: number | null;
  stylePanels: number;
  catalog: PublicCatalog;
  projectItems: PublicAssistantQuoteItem[];
};

export type PublicAssistantQuoteItem = {
  styleId: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  colorId: string;
  glassId: string;
  installation: boolean;
};

export type PublicAssistantRequestContext = {
  step: number;
  productId: string;
  brandId: string;
  styleId: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  colorId: string;
  glassId: string;
  installation: boolean;
  designCount: number;
  folio: string;
  projectItems: PublicAssistantQuoteItem[];
};

export type PublicAssistantAction =
  | { kind: "dimensions"; widthMm: number; heightMm: number }
  | { kind: "width"; widthMm: number }
  | { kind: "height"; heightMm: number }
  | { kind: "quantity"; qty: number }
  | { kind: "product"; productId: string; productName: string }
  | { kind: "style"; styleId: string; styleName: string }
  | { kind: "color"; colorId: string; colorName: string }
  | { kind: "glass"; glassId: string; glassName: string }
  | { kind: "installation"; value: boolean }
  // Configura de una sola vez producto, línea, estilo y medidas a partir del brief. Existe porque
  // la acción "style" aplica las medidas por defecto del estilo y borraba las que el cliente ya
  // había dado: proponer estilo y medidas por separado obligaba a dos confirmaciones y perdía el
  // dato en medio.
  | { kind: "configure"; styleId: string; styleName: string; widthMm: number; heightMm: number; colorId?: string };

export type PublicAssistantReply = {
  text: string;
  action?: PublicAssistantAction;
  /** true cuando la respuesta solo orienta (brief o plantilla de paso) y no contestó algo
   * concreto. Es lo que autoriza al asistente a sustituirla por una propuesta de configuración:
   * sin esta marca, la propuesta pisaba incluso el resumen de "¿qué llevamos?". */
  generic?: true;
};

const STEP_HELP = [
  "Puedo ayudarte a decidir entre una ventana y una puerta. Cuéntame si buscas ventilación, iluminación, acceso o ahorrar espacio.",
  "Aluplast es la línea pública disponible. Las opciones y medidas que ves provienen del catálogo autorizado.",
  "Puedo explicarte cada apertura o recomendarte una según el espacio disponible.",
  "Escribe una medida como “1.80 × 1.20 m”, “180 × 120 cm” o “1800 × 1200 mm”. La convertiré y te pediré confirmación antes de aplicarla.",
  "Puedo cambiar el color entre las opciones disponibles para la línea seleccionada.",
  "Puedo comparar los vidrios disponibles según seguridad, ruido y aislamiento.",
  "La instalación es opcional. Si la incluyes, el servidor recalcula automáticamente el precio público.",
  "El precio es preliminar y se calcula en el servidor con la configuración vigente. No uso precios inventados.",
  "Puedo revisar medidas, estilo, color, vidrio, cantidad y total antes de continuar.",
  "Tu cotización seguirá con revisión, medición, confirmación del precio, depósito, fabricación e instalación.",
  "Ya terminaste la configuración. Completa los datos de contacto y autoriza el seguimiento para registrar el proyecto.",
  "Tu proyecto quedó registrado. Ahora sí puedes descargarlo o continuar con un asesor humano sin repetir la configuración.",
];

const CONFIDENTIAL_TERMS = /margen|utilidad|costo directo|costo de compra|proveedor|despiece|longitud de corte|optimizaci[oó]n de barras|regla interna|prompt del sistema|credencial/i;
const QUANTITY_WORDS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20,
};

export function isConfidentialAssistantRequest(value: string): boolean {
  return CONFIDENTIAL_TERMS.test(value.slice(0, 500));
}

export function publicAssistantRequestContext(context: PublicAssistantContext): PublicAssistantRequestContext {
  return {
    step: context.step,
    productId: context.productId,
    brandId: context.brandId,
    styleId: context.styleId,
    widthMm: context.widthMm,
    heightMm: context.heightMm,
    qty: context.qty,
    colorId: context.colorId,
    glassId: context.glassId,
    installation: context.installation,
    designCount: context.designCount,
    folio: context.folio,
    projectItems: context.projectItems.slice(0, 100),
  };
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function money(value: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

function measurementToMm(value: string, unit?: string): number {
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount)) return 0;
  if (unit === "m") return Math.round(amount * 1000);
  if (unit === "cm") return Math.round(amount * 10);
  return Math.round(amount);
}

function inferSharedUnit(first: number, second?: number): "m" | "cm" | "mm" {
  const largest = Math.max(first, second ?? first);
  if (largest <= 10) return "m";
  if (largest <= 500) return "cm";
  return "mm";
}

function validateDimensions(widthMm: number, heightMm: number, context: PublicAssistantContext): string {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    return "No pude interpretar esas medidas. Prueba con “1.80 × 1.20 m”.";
  }
  if (widthMm < context.minMm || heightMm < context.minMm) {
    return `La medida mínima permitida es ${context.minMm} × ${context.minMm} mm.`;
  }
  if (context.styleMaxW && widthMm > context.styleMaxW) {
    return `El estilo seleccionado admite hasta ${context.styleMaxW.toLocaleString("es-MX")} mm de ancho.`;
  }
  if (context.styleMaxH && heightMm > context.styleMaxH) {
    return `El estilo seleccionado admite hasta ${context.styleMaxH.toLocaleString("es-MX")} mm de alto.`;
  }
  if (widthMm / Math.max(1, context.stylePanels) < context.minMm) {
    return `Con ${context.stylePanels} hojas, el ancho mínimo es ${(context.minMm * context.stylePanels).toLocaleString("es-MX")} mm.`;
  }
  return "";
}

function dimensionProposal(input: string, context: PublicAssistantContext, brief?: AssistantBrief): PublicAssistantReply | null {
  const pair = input.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:x|×|por)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i);
  if (pair) {
    // Sin estilo todavía no se puede PROPONER un cambio de medidas (no hay límites contra los
    // que validar), pero la medida NO se descarta: ya vive en el brief. Antes esta rama
    // devolvía "primero selecciona el producto y el estilo", que era justo el comportamiento
    // que hacía sentir al cliente que sus datos se ignoraban.
    if (!context.styleName) return briefLedReply(brief) ?? { text: STEP_HELP[context.step] ?? STEP_HELP[0] };
    const first = Number(pair[1].replace(",", "."));
    const second = Number(pair[3].replace(",", "."));
    const shared = (pair[2] || pair[4] || inferSharedUnit(first, second)).toLowerCase();
    const widthMm = measurementToMm(pair[1], (pair[2] || shared).toLowerCase());
    const heightMm = measurementToMm(pair[3], (pair[4] || shared).toLowerCase());
    const error = validateDimensions(widthMm, heightMm, context);
    if (error) return { text: `${error} No aplicaré ningún cambio.` };
    return {
      text: `Entendí ${widthMm.toLocaleString("es-MX")} mm de ancho por ${heightMm.toLocaleString("es-MX")} mm de alto. ¿Deseas aplicar estas medidas y recalcular el precio?`,
      action: { kind: "dimensions", widthMm, heightMm },
    };
  }

  const width = input.match(/ancho\s*(?:a|de|es)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i);
  if (width) {
    if (!context.styleName) return briefLedReply(brief) ?? { text: "Registré ese ancho. Cuando elijas el estilo lo valido contra sus límites reales." };
    const raw = Number(width[1].replace(",", "."));
    const widthMm = measurementToMm(width[1], (width[2] || inferSharedUnit(raw)).toLowerCase());
    const error = validateDimensions(widthMm, context.heightMm, context);
    if (error) return { text: `${error} No aplicaré ningún cambio.` };
    return {
      text: `Cambiaré únicamente el ancho de ${context.widthMm.toLocaleString("es-MX")} a ${widthMm.toLocaleString("es-MX")} mm. ¿Deseas continuar?`,
      action: { kind: "width", widthMm },
    };
  }

  const height = input.match(/alto\s*(?:a|de|es)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i);
  if (height) {
    if (!context.styleName) return briefLedReply(brief) ?? { text: "Registré ese alto. Cuando elijas el estilo lo valido contra sus límites reales." };
    const raw = Number(height[1].replace(",", "."));
    const heightMm = measurementToMm(height[1], (height[2] || inferSharedUnit(raw)).toLowerCase());
    const error = validateDimensions(context.widthMm, heightMm, context);
    if (error) return { text: `${error} No aplicaré ningún cambio.` };
    return {
      text: `Cambiaré únicamente el alto de ${context.heightMm.toLocaleString("es-MX")} a ${heightMm.toLocaleString("es-MX")} mm. ¿Deseas continuar?`,
      action: { kind: "height", heightMm },
    };
  }
  return null;
}

function configurationSummary(context: PublicAssistantContext): string {
  const parts = [
    context.productName && `Producto: ${context.productName}`,
    context.styleName && `Estilo: ${context.styleName}`,
    context.brandName && `Línea: ${context.brandName}`,
    context.styleName && `Medidas: ${context.widthMm.toLocaleString("es-MX")} × ${context.heightMm.toLocaleString("es-MX")} mm`,
    context.colorName && `Color: ${context.colorName}`,
    context.glassName && `Vidrio: ${context.glassName}`,
    `Cantidad: ${context.qty}`,
    `Instalación: ${context.installation ? "incluida" : "no incluida"}`,
    context.total !== null && `Total ${context.estimated ? "estimado" : "preliminar"}: ${money(context.total)}`,
  ].filter(Boolean);
  if (context.sizeError) parts.push(`Pendiente: ${context.sizeError}`);
  return parts.length > 2
    ? `Este es el resumen que ya tengo:\n${parts.map((part) => `• ${part}`).join("\n")}`
    : "Todavía falta seleccionar el producto y su estilo. Puedo ayudarte a elegir sin pedirte datos que ya hayas capturado.";
}

function findNamedOption<T extends { name: string }>(input: string, entries: T[]): T | null {
  const normalizedInput = normalize(input);
  return entries.find((entry) => normalizedInput.includes(normalize(entry.name))) ?? null;
}

/**
 * Respuesta construida desde el estado acumulado: reconoce las medidas reales, plantea enfoques
 * y hace UNA pregunta. Es lo que sustituye a las plantillas fijas de STEP_HELP cuando ya se sabe
 * algo del cliente. Devuelve null cuando el brief todavía está vacío.
 */
export function briefLedReply(brief: AssistantBrief | undefined): PublicAssistantReply | null {
  if (!brief) return null;
  const recommendation = briefRecommendation(brief);
  if (!recommendation) return null;
  const question = nextBriefQuestion(brief);
  // Con una pregunta pendiente vale la pena situar al cliente antes de preguntar. Sin ella,
  // repetir el párrafo entero cada turno se siente robótico (§112): basta confirmar lo que ya
  // quedó anotado y ofrecer el siguiente paso concreto.
  if (!question) {
    const lines = briefSummary(brief);
    return { text: `Anotado. Voy con ${lines.join("; ").toLowerCase()}. Cuando elijas el estilo valido estas medidas contra sus límites reales y te muestro el precio.`, generic: true };
  }
  return { text: `${recommendation} ${question.question}` };
}

export function buildPublicAssistantReply(input: string, context: PublicAssistantContext, brief?: AssistantBrief): PublicAssistantReply {
  const text = input.trim().slice(0, 500);
  const normalized = normalize(text);
  // El brief manda sobre la plantilla del paso: si ya sabemos algo del cliente, la respuesta se
  // construye con esos datos en vez de repetir el texto fijo que ignora lo que ya dijo.
  if (!text) return briefLedReply(brief) ?? { text: STEP_HELP[context.step] ?? STEP_HELP[0] };

  if (/que llevamos|que tenemos|resumen de lo que|recuerdas/.test(normalized)) {
    const lines = briefSummary(brief ?? {});
    if (lines.length) return { text: `Esto es lo que llevo de tu proyecto: ${lines.join("; ")}.` };
  }

  if (CONFIDENTIAL_TERMS.test(text)) {
    return { text: "Esa información es interna y no está disponible en el cotizador público. Sí puedo ayudarte con las opciones visibles, validar tu configuración y mostrar el precio público calculado por el servidor." };
  }

  if (/revisa (mi|la) configuracion|resumen|que (he|ya) elegi|todo esta correcto/.test(normalized)) {
    return { text: configurationSummary(context) };
  }

  if (/revisa (mis|las) medidas|medidas correctas/.test(normalized)) {
    if (!context.styleName) return { text: "Primero elige un estilo; así podré validar sus límites reales." };
    const error = validateDimensions(context.widthMm, context.heightMm, context) || context.sizeError;
    return { text: error ? `${error} Esta configuración todavía necesita corrección.` : `Las medidas ${context.widthMm.toLocaleString("es-MX")} × ${context.heightMm.toLocaleString("es-MX")} mm están dentro de los límites públicos del estilo seleccionado. Son referenciales y se verificarán físicamente antes de fabricar.` };
  }

  if (context.step >= 9 && /(cambia|modifica|selecciona|prefiero|\d+\s*(?:x|×|por)\s*\d+)/.test(normalized)) {
    return { text: context.step === 11
      ? "La cotización ya quedó registrada y no modificaré sus datos. Puedes iniciar una nueva configuración si necesitas otra opción."
      : "Tu proyecto ya está en la etapa final. Regresa al resumen antes de registrar tus datos si deseas modificar la configuración; no aplicaré cambios desde esta etapa." };
  }

  const dimensions = dimensionProposal(text, context, brief);
  if (dimensions) return dimensions;

  const quantity = normalized.match(/(?:cantidad|quiero|necesito|serian|son)\s*(?:de\s*)?(\d{1,3}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte)\b/i);
  if (quantity) {
    const qty = /^\d+$/.test(quantity[1]) ? Number(quantity[1]) : QUANTITY_WORDS[quantity[1]];
    if (qty < 1 || qty > context.catalog.maxQty) {
      return { text: `La cantidad permitida por diseño es de 1 a ${context.catalog.maxQty} piezas. No aplicaré ningún cambio.` };
    }
    return { text: `Cambiaré la cantidad de este diseño a ${qty} ${qty === 1 ? "pieza" : "piezas"}. ¿Deseas aplicarlo y recalcular?`, action: { kind: "quantity", qty } };
  }

  const product = findNamedOption(text, context.catalog.products);
  if (product && /(quiero|cambia|selecciona|elegir|cotizar)/.test(normalized)) {
    return { text: `Seleccionaré “${product.name}” y conservaré sin cambios los diseños que ya agregaste. ¿Deseas continuar?`, action: { kind: "product", productId: product.id, productName: product.name } };
  }

  const availableStyles = context.catalog.styles.filter((entry) => !context.productName || context.catalog.products.find((productEntry) => productEntry.name === context.productName)?.id === entry.productId);
  const style = findNamedOption(text, availableStyles) ?? availableStyles.find((entry) => normalized.includes(normalize(entry.name).split(" ")[0]));
  if (style && /(quiero|cambia|selecciona|prefiero|estilo|apertura)/.test(normalized)) {
    return { text: `Cambiaré el estilo a “${style.name}” y usaré sus medidas iniciales ${style.defaultW} × ${style.defaultH} mm. ¿Deseas aplicar el cambio?`, action: { kind: "style", styleId: style.id, styleName: style.name } };
  }

  const availableColors = context.catalog.colors.filter((entry) => !context.brandName || entry.brandId === context.catalog.brands.find((brand) => brand.name === context.brandName)?.id);
  const color = findNamedOption(text, availableColors);
  if (color && /(color|cambia|prefiero|quiero)/.test(normalized)) {
    return { text: `Cambiaré únicamente el color a ${color.name}. ¿Deseas aplicarlo y recalcular?`, action: { kind: "color", colorId: color.id, colorName: color.name } };
  }

  const glass = findNamedOption(text, context.catalog.glass);
  if (glass && /(vidrio|cristal|cambia|prefiero|quiero)/.test(normalized)) {
    return { text: `Cambiaré únicamente el vidrio a ${glass.name}. ¿Deseas aplicarlo y recalcular?`, action: { kind: "glass", glassId: glass.id, glassName: glass.name } };
  }

  if (/sin instalacion|quita.*instalacion|no.*instalacion/.test(normalized)) {
    return { text: "Quitaré la instalación y solicitaré al servidor el nuevo precio. ¿Deseas continuar?", action: { kind: "installation", value: false } };
  }
  if (/incluye.*instalacion|con instalacion|agrega.*instalacion/.test(normalized)) {
    return { text: "Incluiré la instalación profesional y solicitaré al servidor el nuevo precio. ¿Deseas continuar?", action: { kind: "installation", value: true } };
  }

  if (/explica.*apertura|tipos? de apertura|abatible.*corrediza|corrediza.*abatible/.test(normalized)) {
    return { text: "Una fija no abre y prioriza luz. Una corrediza se mueve sobre riel y ahorra espacio. Una abatible gira sobre bisagras y ofrece cierre hermético. Una oscilobatiente abre lateralmente o se inclina para ventilar. Una proyectante abre hacia afuera desde la parte inferior. Solo te mostraré combinaciones autorizadas por el catálogo." };
  }

  if (/colores|que color/.test(normalized)) {
    return { text: availableColors.length ? `Colores disponibles: ${availableColors.map((entry) => entry.name).join(", ")}. Puedes decir “cambia el color a negro”.` : "Selecciona primero una línea para consultar sus colores disponibles." };
  }

  if (/vidrios|cristales|ruido|aislamiento|seguridad/.test(normalized)) {
    return { text: `Opciones confirmadas: ${context.catalog.glass.map((entry) => `${entry.name} — ${entry.benefit}`).join(" ")}` };
  }

  if (/por que cambio.*precio|precio cambio|como.*precio|precio/.test(normalized)) {
    return { text: context.total === null
      ? "El precio aparecerá cuando la configuración sea válida. El servidor lo calcula con medidas, estilo, cantidad, color, vidrio e instalación."
      : `El precio público actual es ${money(context.total)} MXN${context.estimated ? " y está marcado como estimado" : ""}. Puede cambiar al modificar medidas, estilo, cantidad, color, vidrio o instalación. Siempre lo recalcula el servidor.` };
  }

  if (/terminar|finalizar|continuar con la compra/.test(normalized)) {
    return { text: context.step < 8
      ? "Aún faltan decisiones de la configuración. Continúa con el botón inferior; puedo revisar cada etapa sin enviarte todavía con una persona."
      : context.step < 11
        ? "La configuración está en su etapa final. Revisa el resumen, conoce el proceso y registra tus datos para generar el folio."
        : `La cotización ${context.folio || ""} ya está registrada. Ahora sí puedes descargarla o continuar con un asesor humano.` };
  }

  if (/ayudame a elegir|que me recomiendas|necesito ayuda/.test(normalized)) {
    return briefLedReply(brief) ?? { text: STEP_HELP[context.step] ?? STEP_HELP[0], generic: true };
  }

  // Último recurso. El brief tiene prioridad: la plantilla fija solo aparece cuando de verdad
  // no sabemos nada del cliente todavía.
  return briefLedReply(brief)
    ?? { text: `${STEP_HELP[context.step] ?? STEP_HELP[0]} También puedes pedirme: “revisa mis medidas”, “explica las aperturas”, “cambia el color a negro” o “revisa mi configuración”.`, generic: true };
}
