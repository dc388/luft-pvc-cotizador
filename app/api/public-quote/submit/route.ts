import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { brandForStyle, buildComponentData, parseProjectConfigs, priceProjectConfigs, PublicQuoteError, styleNameFor, systemIndexForStyle } from "@/lib/publicQuote";
import { colorIndexFor } from "@/lib/publicCatalog";
import { createComponentWithData, createEmptyProject, setActiveComponent } from "@/lib/projectRepo";
import { clientIp, enforceRateLimit, SUBMIT_RULES, tooManyRequests } from "@/lib/rateLimit";

type Contact = { name: string; phone: string; email: string; city: string };

function parseContact(raw: unknown): Contact {
  const body = (raw ?? {}) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const city = String(body.city ?? "").trim();

  if (name.length < 2) throw new PublicQuoteError("Escribe tu nombre.");
  if (phone.replace(/\D/g, "").length < 10) throw new PublicQuoteError("Escribe un teléfono de 10 dígitos.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PublicQuoteError("Revisa tu correo electrónico.");
  if (city.length < 2) throw new PublicQuoteError("Escribe tu ciudad.");
  if (name.length > 120 || phone.length > 40 || email.length > 160 || city.length > 120) {
    throw new PublicQuoteError("Alguno de los datos es demasiado largo.");
  }
  return { name, phone, email, city };
}

// Guarda cada envío como un Proyecto real con N Componentes, usando el mismo repositorio que
// la app interna. Todas las configuraciones se validan y recalculan antes de escribir; nunca
// se confía en precios o totales enviados por el navegador.
//
// Ésta es la ruta pública que ESCRIBE, así que lleva el límite exacto respaldado en D1
// (5 por hora y 20 por día por IP, ver lib/rateLimit.ts): sin él, cualquiera podría llenar la
// tabla de componentes de cotizaciones basura.
export async function POST(request: Request) {
  try {
    const db = getDb();
    const limit = await enforceRateLimit(db, "public-quote-submit", clientIp(request), SUBMIT_RULES);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSec);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    // `config` se conserva como compatibilidad con clientes anteriores de una sola ventana.
    const configs = parseProjectConfigs(Array.isArray(body.items) ? body.items : [body.config]);
    const contact = parseContact(body.contact);
    const { price, itemPrices } = priceProjectConfigs(configs);

    const folio = `W-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const project = await createEmptyProject(db, `Cotización ${folio}`);
    let firstComponentId = "";

    for (const [index, config] of configs.entries()) {
      const data = buildComponentData(config);
      const brand = brandForStyle(config.styleId);
      const component = await createComponentWithData(db, project.id, {
        code: `${folio}-${String(index + 1).padStart(2, "0")}`,
        designation: styleNameFor(config.styleId),
        location: contact.city,
        qty: config.qty,
        widthMm: config.widthMm,
        heightMm: config.heightMm,
        brand,
        systemIndex: systemIndexForStyle(config.styleId),
        colorIndex: colorIndexFor(brand, config.colorId),
        data: {
          ...data,
          client: contact.name,
          clientAddress: contact.city,
          clientPhone: contact.phone,
          clientEmail: contact.email,
        },
      });
      if (!firstComponentId) firstComponentId = component.id;
    }
    if (firstComponentId) await setActiveComponent(db, project.id, firstComponentId);

    return Response.json({ folio, price, itemPrices }, { status: 201 });
  } catch (error) {
    if (error instanceof PublicQuoteError) return Response.json({ error: error.message }, { status: 400 });
    console.error("public-quote/submit", toRouteErrorMessage(error));
    return Response.json({ error: "No pudimos guardar tu cotización en este momento. Intenta de nuevo." }, { status: 500 });
  }
}
