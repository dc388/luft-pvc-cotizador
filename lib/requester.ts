import type { Address, Requester } from "@/types/project";

// La ficha del solicitante: su forma canónica, cómo se lee de un origen que no controlamos
// (columna JSON de la base, archivo .luftproj importado) y qué se le exige para poder guardarla.
//
// Un solo módulo para las tres cosas a propósito. La ficha se escribe desde el formulario, se
// guarda como JSON, se exporta a un archivo y se vuelve a importar desde uno que pudo escribir
// cualquiera; si cada camino tuviera su propia idea de qué campos existen y cuáles son
// obligatorios, el viaje de ida y vuelta perdería campos por el camino -- que es exactamente lo
// que §4 y §7 del pedido prohíben.

/** Correo y código postal: las mismas reglas que ya aplica el cotizador público al registrar un
 * cliente (ver app/api/public-quote/submit/route.ts), para que un mismo dato no sea válido en una
 * pantalla e inválido en la otra. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_RE = /^\d{5}$/;
const MIN_PHONE_DIGITS = 10;

/** Topes de longitud por campo. No son decoración: la ficha entra por una ruta de API y por un
 * archivo, y sin tope un campo puede llegar con megabytes y engordar cada lectura de la lista. */
const LIMITS = {
  fullName: 160,
  company: 160,
  phone: 40,
  alternatePhone: 40,
  email: 160,
  taxId: 20,
  contactPerson: 160,
  acquisitionChannel: 80,
  notes: 2000,
  street: 240,
  city: 120,
  state: 120,
  postalCode: 12,
  country: 80,
} as const;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function emptyAddress(): Address {
  return { street: "", city: "", state: "", postalCode: "", country: "" };
}

export function isAddressEmpty(address: Address | null | undefined): boolean {
  if (!address) return true;
  return !address.street && !address.city && !address.state && !address.postalCode && !address.country;
}

function normalizeAddress(raw: unknown): Address {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    street: str(source.street, LIMITS.street),
    city: str(source.city, LIMITS.city),
    state: str(source.state, LIMITS.state),
    postalCode: str(source.postalCode, LIMITS.postalCode),
    country: str(source.country, LIMITS.country),
  };
}

/** `null` significa "la misma que la principal" y es distinto de una dirección vacía, así que se
 * conserva la diferencia: solo se devuelve un objeto si el origen traía algo escrito. */
function normalizeOptionalAddress(raw: unknown): Address | null {
  if (raw === null || raw === undefined) return null;
  const address = normalizeAddress(raw);
  return isAddressEmpty(address) ? null : address;
}

export function emptyRequester(now: string): Requester {
  return {
    fullName: "",
    company: "",
    phone: "",
    alternatePhone: "",
    email: "",
    taxId: "",
    contactPerson: "",
    acquisitionChannel: "",
    notes: "",
    address: emptyAddress(),
    installationAddress: null,
    billingAddress: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Lee una ficha desde un origen no confiable.
 *
 * `fallbackName` cubre a los proyectos guardados antes de que existiera la ficha: su cliente vivía
 * en la columna `projects.client` y aquí se recupera como nombre del solicitante, en vez de
 * mostrarlos como si nunca hubieran tenido cliente. Es la migración de lectura que la migración
 * 0005 deliberadamente no hizo en SQL.
 */
export function normalizeRequester(
  raw: unknown,
  options: { now: string; fallbackName?: string; createdAt?: string; updatedAt?: string }
): Requester {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const base = emptyRequester(options.now);
  const fullName = str(source.fullName, LIMITS.fullName) || str(options.fallbackName, LIMITS.fullName);
  return {
    ...base,
    fullName,
    company: str(source.company, LIMITS.company),
    phone: str(source.phone, LIMITS.phone),
    alternatePhone: str(source.alternatePhone, LIMITS.alternatePhone),
    email: str(source.email, LIMITS.email),
    taxId: str(source.taxId, LIMITS.taxId),
    contactPerson: str(source.contactPerson, LIMITS.contactPerson),
    acquisitionChannel: str(source.acquisitionChannel, LIMITS.acquisitionChannel),
    notes: str(source.notes, LIMITS.notes),
    address: normalizeAddress(source.address),
    installationAddress: normalizeOptionalAddress(source.installationAddress),
    billingAddress: normalizeOptionalAddress(source.billingAddress),
    createdAt: str(source.createdAt, 40) || options.createdAt || options.now,
    updatedAt: str(source.updatedAt, 40) || options.updatedAt || options.now,
  };
}

/** Aplica un cambio parcial y marca la fecha de actualización. `createdAt` nunca se sobrescribe:
 * es cuándo se registró al solicitante, no cuándo se editó su ficha. */
export function mergeRequester(current: Requester, patch: Partial<Requester>, now: string): Requester {
  const merged = normalizeRequester({ ...current, ...patch }, { now });
  return { ...merged, createdAt: current.createdAt, updatedAt: now };
}

/**
 * Qué impide guardar la ficha. Devuelve un mensaje por campo con problema, no lanza: el formulario
 * los muestra todos juntos en vez de uno por intento.
 *
 * Deliberadamente corto. El RFC, la persona de contacto y las direcciones alternas NO se exigen
 * nunca (§4: "No obligues a llenar datos fiscales o secundarios para poder crear un proyecto"), y
 * el teléfono y el correo solo se revisan si se escribieron: un proyecto puede empezar con el
 * nombre del solicitante y nada más.
 */
export function requesterIssues(requester: Requester): { field: keyof Requester | "address"; message: string }[] {
  const issues: { field: keyof Requester | "address"; message: string }[] = [];
  if (requester.phone && requester.phone.replace(/\D/g, "").length < MIN_PHONE_DIGITS) {
    issues.push({ field: "phone", message: `El teléfono debe tener al menos ${MIN_PHONE_DIGITS} dígitos.` });
  }
  if (requester.alternatePhone && requester.alternatePhone.replace(/\D/g, "").length < MIN_PHONE_DIGITS) {
    issues.push({ field: "alternatePhone", message: `El teléfono alternativo debe tener al menos ${MIN_PHONE_DIGITS} dígitos.` });
  }
  if (requester.email && !EMAIL_RE.test(requester.email)) {
    issues.push({ field: "email", message: "Revisa el correo electrónico." });
  }
  for (const [address, label] of [
    [requester.address, "principal"],
    [requester.installationAddress, "de instalación"],
    [requester.billingAddress, "de facturación"],
  ] as const) {
    if (address?.postalCode && !POSTAL_RE.test(address.postalCode)) {
      issues.push({ field: "address", message: `El código postal de la dirección ${label} son 5 dígitos.` });
    }
  }
  return issues;
}

/** Una línea con la dirección, para listas y documentos. Omite lo que esté vacío en vez de dejar
 * comas huérfanas. */
export function formatAddress(address: Address | null | undefined): string {
  if (!address) return "";
  return [address.street, address.city, address.state, address.postalCode, address.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}
