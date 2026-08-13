// Decimal exacto para precios de proveedor.
//
// El problema es real y está en el archivo: donde la lista de MACO imprime 11.38, el .xlsx guarda
// literalmente `11.379999999999999`, y hay 152 celdas así en la revisión ABR_22. Eso pasa porque
// la hoja de cálculo escribió el double más cercano al resultado de una operación, que queda a un
// ULP del double más cercano a 11.38. Guardar ese número en un REAL conserva la basura, y un
// `Number(x).toString()` tampoco la quita: la representación más corta que reproduce ESE double
// sigue siendo "11.379999999999999".
//
// Lo que se hace es recuperar el decimal que el proveedor realmente escribió: buscar la escala
// más pequeña (hasta MAX_SCALE) cuyo redondeo vuelve al mismo double dentro de unos pocos ULP.
// Para 11.379999999999999 esa escala es 2 y el decimal es "11.38".
//
// El margen es holgado frente al ruido de coma flotante (~1e-16 relativo) y muy estrecho frente a
// una diferencia real: dos precios distintos con 6 decimales se separan al menos 1e-6, unos cinco
// órdenes de magnitud por encima del margen. Un número que necesite más de MAX_SCALE decimales no
// se adivina: se devuelve `null` y el importador rechaza la fila en vez de truncar dinero.

/** Decimales máximos que se aceptan en un precio. Más que eso no es un precio, es un error. */
export const MAX_SCALE = 6;

/** Margen relativo para dar por equivalentes dos doubles. Ver la nota de cabecera. */
const EPSILON_RELATIVE = 1e-11;

export type ExactDecimal = {
  /** Decimal canónico en texto, sin ceros de relleno: "11.38". Fuente de verdad. */
  text: string;
  /** El mismo número como entero exacto: 1138. */
  minor: number;
  /** Decimales de `minor`. 2 para 1138 => 11.38. */
  scale: number;
};

const PLAIN_DECIMAL = /^-?\d+(?:\.\d+)?$/;
const SCIENTIFIC = /^-?\d+(?:\.\d+)?[eE][+-]?\d+$/;

/** Quita ceros finales de la parte decimal (y el punto si queda sola). "11.380" -> "11.38". */
function trimTrailingZeros(text: string): string {
  if (!text.includes(".")) return text;
  const trimmed = text.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed === "" || trimmed === "-" ? "0" : trimmed;
}

/** Convierte un decimal canónico en su entero exacto, por texto: nunca multiplica en flotante. */
function toMinor(text: string): { minor: number; scale: number } | null {
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  const minor = Number(digits);
  if (!Number.isSafeInteger(minor)) return null;
  return { minor: negative ? -minor : minor, scale: fraction.length };
}

function build(text: string): ExactDecimal | null {
  const canonical = trimTrailingZeros(text);
  const parts = toMinor(canonical);
  if (!parts) return null;
  // "-0" y "0.0" colapsan al mismo cero; que el texto lo refleje evita dos representaciones.
  if (parts.minor === 0) return { text: "0", minor: 0, scale: 0 };
  return { text: canonical, minor: parts.minor, scale: parts.scale };
}

/**
 * Devuelve el decimal exacto que representa `raw`, o `null` si no se puede afirmar con
 * seguridad (texto no numérico, o precisión mayor que MAX_SCALE).
 *
 * `raw` es el texto tal como lo guardó la hoja de cálculo, no un número ya convertido: la
 * conversión a `number` es justo lo que hay que poder deshacer.
 */
export function canonicalDecimal(raw: string, maxScale: number = MAX_SCALE): ExactDecimal | null {
  const text = raw.trim();
  if (text === "") return null;

  if (PLAIN_DECIMAL.test(text)) {
    const fraction = text.split(".")[1] ?? "";
    // Ya viene con precisión de precio: se respeta el texto original, sin pasar por flotante.
    if (fraction.length <= maxScale) return build(text);
  } else if (!SCIENTIFIC.test(text)) {
    return null;
  }

  const value = Number(text);
  if (!Number.isFinite(value)) return null;

  const tolerance = Math.max(Math.abs(value), 1) * EPSILON_RELATIVE;
  for (let scale = 0; scale <= maxScale; scale++) {
    const rounded = value.toFixed(scale);
    if (Math.abs(Number(rounded) - value) <= tolerance) return build(rounded);
  }
  return null;
}

/** Formatea un entero exacto y su escala como decimal legible: (1138, 2) -> "11.38". */
export function formatExact(minor: number, scale: number): string {
  if (scale <= 0) return String(minor);
  const negative = minor < 0;
  const digits = String(Math.abs(minor)).padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Multiplica un decimal exacto por una cantidad entera y por un tipo de cambio, y devuelve el
 * resultado redondeado a 2 decimales. Se usa solo en el costeo verificado (lib/maco/costing.ts).
 * El producto se hace sobre el entero exacto para no arrastrar el error de partida.
 */
export function multiplyExact(minor: number, scale: number, quantity: number, rate: number): number {
  return (minor * quantity * rate) / 10 ** scale;
}
