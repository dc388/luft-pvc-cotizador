import type { Metadata } from "next";
import { getDb } from "@/db";
import { PublicQuoteDocument } from "@/components/cotizar/PublicQuoteDocument";
import { parseQuoteSnapshot } from "@/lib/quoteDocument";
import { getQuoteByToken } from "@/lib/quoteRepo";
import { PrintButton } from "./PrintButton";

// La cotización definitiva del cliente. AQUÍ, y en ningún otro lugar del recorrido público,
// aparece el precio.
//
// Se abre con un token opaco y no con el folio: el folio es consecutivo (LUFT-2026-000001), así
// que quien tuviera el suyo podría leer la cotización del vecino sumando uno. La ruta está en la
// lista de rutas públicas de lib/internalGate.ts a propósito -- todo lo demás fuera de /cotizar
// está detrás de la contraseña interna.
//
// Server component: el documento se renderiza en el servidor a partir de lo guardado. El
// navegador recibe el HTML del documento, no un JSON de precios que pudiera leerse antes de
// terminar de configurar.

export const metadata: Metadata = {
  title: "Tu cotización · LUFT PVC",
  // El documento lleva datos personales y precios: no debe indexarse ni aparecer en un buscador.
  robots: { index: false, follow: false },
};

export default async function QuoteDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const { print } = await searchParams;
  let snapshot = null;
  try {
    const row = await getQuoteByToken(getDb(), token);
    snapshot = row ? parseQuoteSnapshot(row.snapshot) : null;
  } catch (error) {
    console.error("cotizacion/[token]", error instanceof Error ? error.message : "error");
  }

  if (!snapshot) {
    return (
      <main className="quoteDocShell">
        <div className="quoteDocMissing">
          <h1>No encontramos esta cotización</h1>
          <p>
            El enlace puede estar incompleto o haber sido reemplazado por una cotización más reciente. Escríbenos por
            WhatsApp con tu folio y te reenviamos el documento.
          </p>
          <a className="quoteDocLink" href="/cotizar">Armar una cotización nueva</a>
        </div>
      </main>
    );
  }

  return (
    <main className="quoteDocShell">
      <header className="quoteDocBar">
        <span>
          <b>Cotización {snapshot.folio}</b>
          <small>{snapshot.customer.name}</small>
        </span>
        <PrintButton auto={print === "1"} />
      </header>
      <PublicQuoteDocument snapshot={snapshot} />
      <p className="quoteDocFoot">
        Guarda o imprime este documento. Un asesor de LUFT PVC dará seguimiento a tu proyecto con los datos que
        registraste.
      </p>
    </main>
  );
}
