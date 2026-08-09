import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { brandForStyle, buildComponentData, parseConfig, priceConfig, PublicQuoteError, styleNameFor, systemIndexForStyle } from "@/lib/publicQuote";
import { colorIndexFor } from "@/lib/publicCatalog";
import { createComponentWithData, getOrCreateProjectByName } from "@/lib/projectRepo";
import { clientIp, enforceRateLimit, SUBMIT_RULES, tooManyRequests } from "@/lib/rateLimit";

// Proyecto contenedor donde el equipo encuentra todo lo que llega del cotizador público,
// separado de los proyectos que arman los vendedores en la app interna.
const WEB_PROJECT_NAME = "Cotizador web";

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

// Guarda la cotización como un Componente real dentro del proyecto "Cotizador web", usando el
// mismo repositorio que la app interna -- así aparece ahí sin ningún camino de guardado
// paralelo. El precio se vuelve a calcular en el servidor: nunca se confía en el que traiga
// el navegador.
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
    const config = parseConfig(body.config);
    const contact = parseContact(body.contact);
    const price = priceConfig(config);

    const data = buildComponentData(config);
    const brand = brandForStyle(config.styleId);
    const project = await getOrCreateProjectByName(db, WEB_PROJECT_NAME);
    const folio = `W-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    await createComponentWithData(db, project.id, {
      code: folio,
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

    return Response.json({ folio, price }, { status: 201 });
  } catch (error) {
    if (error instanceof PublicQuoteError) return Response.json({ error: error.message }, { status: 400 });
    console.error("public-quote/submit", toRouteErrorMessage(error));
    return Response.json({ error: "No pudimos guardar tu cotización en este momento. Intenta de nuevo." }, { status: 500 });
  }
}
