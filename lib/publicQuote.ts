import { catalog } from "@/data/catalog";
import { colors } from "@/data/colors";
import { glassCatalog } from "@/data/glass";
import { calcQuote, MIN_OPENING_MM } from "@/lib/calc";
import { getCompanySettings, splitDeposit } from "@/lib/companySettings";
import { defaultComponentData } from "@/lib/componentDefaults";
import { colorIndexFor, findStyle, glassIndexFor, isEstimatedSystem, MAX_QTY } from "@/lib/publicCatalog";
import { defaultMarco, walkLeaves } from "@/lib/tree";
import type { Brand } from "@/types/domain";
import type { ComponentData } from "@/types/project";

// Núcleo del cotizador público (app/cotizar). Vive solo en el servidor: valida la
// configuración que manda el navegador contra los catálogos reales y cotiza con el MISMO
// motor que la app interna (lib/calc.ts). El cliente nunca manda margen, descuento ni precios
// -- esos los fija el negocio aquí, no el formulario.

// Política comercial exclusiva del servidor público. `calcQuote` interpreta margin como
// margen bruto sobre venta: sale = direct / (1 - margin). Elegimos el punto medio del rango
// autorizado (40–45%) y anulamos descuentos públicos para que el precio mostrado no pueda
// caer fuera del rango por cambios en defaults del editor profesional.
const PUBLIC_GROSS_MARGIN_PERCENT = 42;
const PUBLIC_GROSS_MARGIN_MIN = 40;
const PUBLIC_GROSS_MARGIN_MAX = 45;

export type PublicExtras = {
  instalacion: boolean;
};

export type PublicQuoteConfig = {
  styleId: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  colorId: string;
  glassId: string;
  extras: PublicExtras;
};

export type PublicPrice = {
  /** Precio de venta por unidad, ya con margen y sin desglose interno. */
  unit: number;
  /** Precio total (unit × cantidad). */
  total: number;
  /** Reservado para futuros servicios que deban confirmar precio con un asesor. */
  hasQuoteOnRequestItems: boolean;
  /** true cuando el sistema cotizado no tiene precios de lista del proveedor. La UI DEBE
   * presentarlo como precio aproximado sujeto a confirmación, nunca como precio en firme. */
  estimated: boolean;
  /** Desglose del anticipo, calculado en servidor a partir del porcentaje configurado
   * (lib/companySettings.ts). El navegador nunca decide cuánto debe depositar un cliente.
   * Es informativo: los datos bancarios NO se envían al cotizador público -- solo se
   * entregan cuando un asesor confirma la cotización tras la medición. */
  depositPercentage: number;
  deposit: number;
  remaining: number;
};

// La interfaz no impone un límite práctico de ventanas, pero el servidor sí necesita un
// techo anti-abuso para que un único payload no consuma memoria o llene la base de datos.
// Cien configuraciones por proyecto cubren holgadamente una vivienda o edificio pequeño.
export const MAX_PROJECT_ITEMS = 100;

export class PublicQuoteError extends Error {}

function asInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function asBool(value: unknown): boolean {
  return value === true;
}

// Valida y normaliza el payload crudo del navegador. Lanza PublicQuoteError con un mensaje
// apto para mostrarle a un cliente final (nada de detalles técnicos ni nombres de archivo).
export function parseConfig(raw: unknown): PublicQuoteConfig {
  const body = (raw ?? {}) as Record<string, unknown>;
  // findStyle solo resuelve estilos del allowlist de publicCatalog: cualquier combinación de
  // sistema y apertura fuera de esa lista queda descartada aquí, antes de tocar el motor.
  const style = findStyle(String(body.styleId ?? ""));
  if (!style) throw new PublicQuoteError("Elige un estilo de la lista para continuar.");

  const sys = catalog[style.brand][style.systemIndex];
  const widthMm = asInt(body.widthMm);
  const heightMm = asInt(body.heightMm);
  const qty = asInt(body.qty);

  if (widthMm === null || heightMm === null) throw new PublicQuoteError("Escribe el ancho y el alto en milímetros.");
  if (qty === null || qty < 1 || qty > MAX_QTY) throw new PublicQuoteError(`La cantidad debe estar entre 1 y ${MAX_QTY} piezas.`);
  if (widthMm < MIN_OPENING_MM || heightMm < MIN_OPENING_MM) {
    throw new PublicQuoteError(`La medida mínima es de ${MIN_OPENING_MM} mm por lado.`);
  }
  if (widthMm > sys.maxW || heightMm > sys.maxH) {
    throw new PublicQuoteError(`Ese estilo se fabrica hasta ${sys.maxW} × ${sys.maxH} mm. Para medidas mayores, un asesor puede ayudarte.`);
  }
  // Cada hoja se reparte el ancho a partes iguales; ninguna puede quedar por debajo del
  // mínimo fabricable, o el vano no se puede producir aunque el total sí cumpla.
  if (widthMm / style.panels < MIN_OPENING_MM) {
    throw new PublicQuoteError(`Con ${style.panels} hojas, el ancho mínimo es de ${MIN_OPENING_MM * style.panels} mm. Elige un estilo con menos hojas o aumenta el ancho.`);
  }

  const colorId = String(body.colorId ?? "");
  if (colorIndexFor(style.brand, colorId) < 0) throw new PublicQuoteError("Elige un color de la lista.");
  const glassId = String(body.glassId ?? "");
  if (glassIndexFor(glassId) < 0) throw new PublicQuoteError("Elige una opción de vidrio de la lista.");

  const extrasRaw = (body.extras ?? {}) as Record<string, unknown>;
  return {
    styleId: style.id,
    widthMm,
    heightMm,
    qty,
    colorId,
    glassId,
    extras: {
      instalacion: asBool(extrasRaw.instalacion),
    },
  };
}

export function parseProjectConfigs(raw: unknown): PublicQuoteConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new PublicQuoteError("Agrega al menos una ventana a tu proyecto.");
  }
  if (raw.length > MAX_PROJECT_ITEMS) {
    throw new PublicQuoteError(`Un proyecto puede incluir hasta ${MAX_PROJECT_ITEMS} configuraciones. Un asesor puede ayudarte con proyectos mayores.`);
  }
  return raw.map(parseConfig);
}

// Construye el ComponentData real (el mismo que guarda la app interna) a partir de la
// configuración pública. Margen, transporte e instalación salen de los valores de negocio ya
// definidos en defaultComponentData() -- el cliente no puede tocarlos.
export function buildComponentData(config: PublicQuoteConfig): ComponentData {
  const style = findStyle(config.styleId);
  if (!style) throw new PublicQuoteError("Elige un estilo de la lista para continuar.");
  const base = defaultComponentData();
  const tree = style.build();
  const leaves = walkLeaves(tree);

  return {
    ...base,
    margin: PUBLIC_GROSS_MARGIN_PERCENT,
    discount: 0,
    rail: style.rail,
    glassIndex: glassIndexFor(config.glassId),
    installation: config.extras.instalacion ? base.installation : 0,
    tree,
    // Cortina/persiana exterior y mosquitero no forman parte del cotizador público. Una
    // pestaña antigua puede enviarlos, pero parseConfig los descarta y aquí quedan apagados.
    marco: defaultMarco(),
    selectedId: leaves[0]?.id ?? "",
  };
}

export function priceConfig(config: PublicQuoteConfig): PublicPrice {
  const style = findStyle(config.styleId);
  if (!style) throw new PublicQuoteError("Elige un estilo de la lista para continuar.");
  const data = buildComponentData(config);
  const colorIndex = colorIndexFor(style.brand, config.colorId);

  const calc = calcQuote({
    width: config.widthMm,
    height: config.heightMm,
    qty: config.qty,
    tree: data.tree,
    sys: catalog[style.brand][style.systemIndex],
    glass: glassCatalog[data.glassIndex],
    color: colors[style.brand][colorIndex],
    rail: data.rail,
    installation: data.installation,
    transport: data.transport,
    margin: data.margin,
    discount: data.discount,
    marco: data.marco,
    barLengthMm: data.barLengthMm,
  });

  // Defensa adicional: si una modificación futura del motor o de la configuración pública
  // rompe la política comercial, se detiene la respuesta en servidor. Nunca se envían al
  // navegador `direct`, `utility` ni el porcentaje usado para esta comprobación.
  const realizedGrossMargin = calc.sale > 0 ? ((calc.sale - calc.direct) / calc.sale) * 100 : 0;
  if (realizedGrossMargin < PUBLIC_GROSS_MARGIN_MIN || realizedGrossMargin > PUBLIC_GROSS_MARGIN_MAX) {
    throw new Error("La cotización pública quedó fuera de la política comercial configurada.");
  }

  // Solo se devuelve el precio comercial. `direct`, `utility`, `profileCost`, la lista de
  // corte y demás internos de QuoteCalc nunca salen de este archivo.
  const total = Math.round(calc.total);
  const { depositPercentage, deposit, remaining } = splitDeposit(total, getCompanySettings().depositPercentage);
  return {
    unit: Math.round(calc.sale),
    total,
    hasQuoteOnRequestItems: false,
    estimated: isEstimatedSystem(style.brand, style.systemIndex),
    depositPercentage,
    deposit,
    remaining,
  };
}

// Lo único que el cotizador público le puede preguntar al motor sin recibir dinero de vuelta:
// "¿esta configuración se puede fabricar y cotizar?". El cálculo se ejecuta completo -- incluida
// la comprobación de política comercial de priceConfig -- y el importe se descarta aquí, en el
// servidor. Es la pieza que permite que la interfaz sepa qué estilos ofrecer sin que ninguna
// cifra cruce al navegador.
export type PublicConfigAvailability = { available: true } | { available: false; reason: string };

export function checkConfig(raw: unknown): PublicConfigAvailability {
  try {
    priceConfig(parseConfig(raw));
    return { available: true };
  } catch (error) {
    if (error instanceof PublicQuoteError) return { available: false, reason: error.message };
    // Un fallo que no sea de validación (motor, política comercial) no se le explica al cliente
    // con detalles técnicos, pero tampoco se disfraza de "disponible".
    console.error("public-quote/check", error instanceof Error ? error.message : "error");
    return { available: false, reason: "No disponible en esta medida." };
  }
}

// Cada configuración se resuelve por separado a propósito. El lote de precios sí falla completo
// al primer elemento inválido (parseProjectConfigs lanza), y eso está bien cuando se cotiza un
// proyecto real; pero la pantalla de estilos pregunta por siete a la vez y uno fuera de rango
// dejaría a los otros seis sin respuesta.
export function checkConfigs(raw: unknown): PublicConfigAvailability[] {
  if (!Array.isArray(raw)) throw new PublicQuoteError("Agrega al menos una ventana a tu proyecto.");
  if (raw.length > MAX_PROJECT_ITEMS) {
    throw new PublicQuoteError(`Un proyecto puede incluir hasta ${MAX_PROJECT_ITEMS} configuraciones. Un asesor puede ayudarte con proyectos mayores.`);
  }
  return raw.map(checkConfig);
}

export function priceProjectConfigs(configs: PublicQuoteConfig[]): { price: PublicPrice; itemPrices: PublicPrice[] } {
  if (configs.length === 0) throw new PublicQuoteError("Agrega al menos una ventana a tu proyecto.");
  const itemPrices = configs.map(priceConfig);
  const total = itemPrices.reduce((sum, item) => sum + item.total, 0);
  const { depositPercentage, deposit, remaining } = splitDeposit(total, getCompanySettings().depositPercentage);

  return {
    price: {
      // En un proyecto de varias configuraciones no existe un único precio unitario. Se
      // conserva el contrato de PublicPrice y se usa el total; cada renglón mantiene su
      // precio unitario real dentro de itemPrices.
      unit: total,
      total,
      hasQuoteOnRequestItems: itemPrices.some((item) => item.hasQuoteOnRequestItems),
      estimated: itemPrices.some((item) => item.estimated),
      depositPercentage,
      deposit,
      remaining,
    },
    itemPrices,
  };
}

export function brandForStyle(styleId: string): Brand {
  const style = findStyle(styleId);
  if (!style) throw new PublicQuoteError("Elige un estilo de la lista para continuar.");
  return style.brand;
}

export function systemIndexForStyle(styleId: string): number {
  const style = findStyle(styleId);
  if (!style) throw new PublicQuoteError("Elige un estilo de la lista para continuar.");
  return style.systemIndex;
}

export function styleNameFor(styleId: string): string {
  return findStyle(styleId)?.name ?? "";
}
