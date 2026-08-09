import { catalog } from "@/data/catalog";
import { colors } from "@/data/colors";
import { glassCatalog } from "@/data/glass";
import { calcQuote, MIN_OPENING_MM } from "@/lib/calc";
import { defaultComponentData } from "@/lib/componentDefaults";
import { colorIndexFor, findStyle, glassIndexFor, isEstimatedSystem, MAX_QTY } from "@/lib/publicCatalog";
import { defaultMarco, walkLeaves } from "@/lib/tree";
import type { Brand, FrameNode } from "@/types/domain";
import type { ComponentData } from "@/types/project";

// Núcleo del cotizador público (app/cotizar). Vive solo en el servidor: valida la
// configuración que manda el navegador contra los catálogos reales y cotiza con el MISMO
// motor que la app interna (lib/calc.ts). El cliente nunca manda margen, descuento ni precios
// -- esos los fija el negocio aquí, no el formulario.

export type PublicExtras = {
  instalacion: boolean;
  persianaExterior: boolean;
  mosquitero: boolean;
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
  /** true cuando el cliente pidió algo que el motor no tarifa todavía (mosquitero) y que
   * por tanto NO está incluido en `total` -- la UI debe decirlo explícitamente. */
  hasQuoteOnRequestItems: boolean;
  /** true cuando el sistema cotizado no tiene precios de lista del proveedor (hoy, todo
   * Deceuninck -- ver isEstimatedSystem). La UI DEBE presentarlo como precio aproximado
   * sujeto a confirmación, nunca como precio en firme. */
  estimated: boolean;
};

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
      persianaExterior: asBool(extrasRaw.persianaExterior),
      mosquitero: asBool(extrasRaw.mosquitero),
    },
  };
}

function withMallorquina(tree: FrameNode): FrameNode {
  if (tree.kind === "leaf") return { ...tree, spec: { ...tree.spec, mallorquina: true } };
  return { ...tree, children: tree.children.map(withMallorquina) };
}

// Construye el ComponentData real (el mismo que guarda la app interna) a partir de la
// configuración pública. Margen, transporte e instalación salen de los valores de negocio ya
// definidos en defaultComponentData() -- el cliente no puede tocarlos.
export function buildComponentData(config: PublicQuoteConfig): ComponentData {
  const style = findStyle(config.styleId);
  if (!style) throw new PublicQuoteError("Elige un estilo de la lista para continuar.");
  const base = defaultComponentData();
  const tree = config.extras.persianaExterior ? withMallorquina(style.build()) : style.build();
  const leaves = walkLeaves(tree);

  return {
    ...base,
    rail: style.rail,
    glassIndex: glassIndexFor(config.glassId),
    installation: config.extras.instalacion ? base.installation : 0,
    tree,
    marco: { ...defaultMarco(), mosquitero: config.extras.mosquitero },
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

  // Solo se devuelve el precio comercial. `direct`, `utility`, `profileCost`, la lista de
  // corte y demás internos de QuoteCalc nunca salen de este archivo.
  return {
    unit: Math.round(calc.sale),
    total: Math.round(calc.total),
    // El mosquitero no tiene tarifa en el motor y la regla del proyecto es no inventar una,
    // así que se registra en la cotización pero no se suma al total.
    hasQuoteOnRequestItems: config.extras.mosquitero,
    estimated: isEstimatedSystem(style.brand, style.systemIndex),
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
