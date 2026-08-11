import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { brandForStyle, buildComponentData, parseProjectConfigs, priceProjectConfigs, PublicQuoteError, styleNameFor, systemIndexForStyle } from "@/lib/publicQuote";
import { colorIndexFor } from "@/lib/publicCatalog";
import { createComponentWithData, createEmptyProject, labelProjectWithFolio, setActiveComponent } from "@/lib/projectRepo";
import { buildQuoteSnapshot, type QuoteCustomerInput } from "@/lib/quoteDocument";
import { createQuote, upsertCustomer } from "@/lib/quoteRepo";
import { clientIp, enforceRateLimit, SUBMIT_RULES, tooManyRequests } from "@/lib/rateLimit";

// Los datos que el cotizador pide en la pantalla de contacto. Obligatorios: nombre, WhatsApp y
// ciudad -- son los tres con los que un asesor puede dar seguimiento. Todo lo demás ayuda a
// preparar la propuesta pero no bloquea al cliente.
type Contact = QuoteCustomerInput & {
  projectName: string;
  notes: string;
  consentToContact: true;
};

function field(raw: Record<string, unknown>, key: string, max: number): string {
  const value = String(raw[key] ?? "").trim();
  if (value.length > max) throw new PublicQuoteError("Alguno de los datos es demasiado largo.");
  return value;
}

function parseContact(raw: unknown): Contact {
  const body = (raw ?? {}) as Record<string, unknown>;
  const name = field(body, "name", 120);
  const phone = field(body, "phone", 40);
  const email = field(body, "email", 160);
  const company = field(body, "company", 160);
  const city = field(body, "city", 120);
  const postalCode = field(body, "postalCode", 12);
  const address = field(body, "address", 240);
  const projectName = field(body, "projectName", 160);
  const notes = field(body, "notes", 1000);

  if (name.length < 2) throw new PublicQuoteError("Escribe tu nombre.");
  if (phone.replace(/\D/g, "").length < 10) throw new PublicQuoteError("Escribe un teléfono o WhatsApp de 10 dígitos.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PublicQuoteError("Revisa tu correo electrónico.");
  if (city.length < 2) throw new PublicQuoteError("Escribe tu ciudad o municipio.");
  if (postalCode && !/^\d{5}$/.test(postalCode)) throw new PublicQuoteError("El código postal son 5 dígitos.");
  if (body.consentToContact !== true) throw new PublicQuoteError("Autoriza el contacto para registrar y dar seguimiento a tu cotización.");

  return { name, phone, email, company, city, postalCode, address, projectName, notes, consentToContact: true };
}

// Registra la cotización: guarda al cliente, congela el documento definitivo y crea la carpeta de
// trabajo con sus N componentes, usando el mismo repositorio que la app interna. Todas las
// configuraciones se validan y recalculan aquí; nunca se confía en precios enviados por el
// navegador -- de hecho el navegador ya no conoce ninguno.
//
// LA RESPUESTA NO LLEVA IMPORTES. Devuelve el folio y la ruta del documento; el precio aparece por
// primera vez al abrir ese documento (app/cotizacion/[token]).
//
// Ésta es la ruta pública que ESCRIBE, así que lleva el límite exacto respaldado en D1
// (5 por hora y 20 por día por IP, ver lib/rateLimit.ts): sin él, cualquiera podría llenar la
// base de cotizaciones basura.
export async function POST(request: Request) {
  try {
    const db = getDb();
    const limit = await enforceRateLimit(db, "public-quote-submit", clientIp(request), SUBMIT_RULES);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSec);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    // `config` se conserva como compatibilidad con clientes anteriores de una sola ventana.
    const configs = parseProjectConfigs(Array.isArray(body.items) ? body.items : [body.config]);
    const contact = parseContact(body.contact);
    const { price } = priceProjectConfigs(configs);
    const pieceCount = configs.reduce((sum, config) => sum + config.qty, 0);

    const customer: QuoteCustomerInput = {
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      company: contact.company,
      city: contact.city,
      postalCode: contact.postalCode,
      address: contact.address,
    };
    // Primero el cliente: si el mismo teléfono ya cotizó antes, la cotización nueva se cuelga de
    // su expediente en vez de crear un segundo "José Pérez".
    const { id: customerId } = await upsertCustomer(db, customer);
    const projectName = contact.projectName || `Proyecto de ${contact.name}`;

    // La carpeta de trabajo se crea antes de la cotización para poder guardar su id en el
    // expediente. Si algo falla después, queda una carpeta sin cotización -- visible y
    // recuperable, que es preferible a una cotización que apunta a una carpeta inexistente.
    const project = await createEmptyProject(db, `Cotización WEB · ${projectName}`, {
      source: "web",
      folio: "",
      client: contact.name,
    });

    const quote = await createQuote(db, {
      customerId,
      projectId: project.id,
      projectName,
      notes: contact.notes,
      itemCount: configs.length,
      pieceCount,
      total: price.total,
      snapshotFor: (folio, issuedAt) =>
        buildQuoteSnapshot(configs, customer, { name: projectName, notes: contact.notes }, folio, issuedAt),
    });

    // El folio real se conoce al reservarlo, así que la carpeta se etiqueta después. Es lo que
    // permite reconocer la cotización desde la lista de carpetas del editor.
    await createProjectComponents(db, project.id, configs, quote.folio, contact);
    await labelProjectWithFolio(db, project.id, quote.folio, `Cotización WEB ${quote.folio} · ${projectName}`);

    return Response.json({ folio: quote.folio, documentPath: `/cotizacion/${quote.token}` }, { status: 201 });
  } catch (error) {
    if (error instanceof PublicQuoteError) return Response.json({ error: error.message }, { status: 400 });
    console.error("public-quote/submit", toRouteErrorMessage(error));
    return Response.json({ error: "No pudimos guardar tu cotización en este momento. Intenta de nuevo." }, { status: 500 });
  }
}

type Db = ReturnType<typeof getDb>;

async function createProjectComponents(
  db: Db,
  projectId: string,
  configs: ReturnType<typeof parseProjectConfigs>,
  folio: string,
  contact: Contact
): Promise<void> {
  let firstComponentId = "";
  for (const [index, config] of configs.entries()) {
    const data = buildComponentData(config);
    const brand = brandForStyle(config.styleId);
    const component = await createComponentWithData(db, projectId, {
      code: `${folio}-${String(index + 1).padStart(2, "0")}`,
      designation: styleNameFor(config.styleId),
      location: contact.address || contact.city,
      qty: config.qty,
      widthMm: config.widthMm,
      heightMm: config.heightMm,
      brand,
      systemIndex: systemIndexForStyle(config.styleId),
      colorIndex: colorIndexFor(brand, config.colorId),
      data: {
        ...data,
        client: contact.name,
        clientAddress: contact.address || contact.city,
        clientPhone: contact.phone,
        clientEmail: contact.email,
      },
    });
    if (!firstComponentId) firstComponentId = component.id;
  }
  if (firstComponentId) await setActiveComponent(db, projectId, firstComponentId);
}
