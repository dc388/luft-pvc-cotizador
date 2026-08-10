import type { ReactNode } from "react";
import { money } from "@/lib/money";

export type QuoteDocumentItem = {
  id: string;
  code: string;
  title: string;
  location?: string;
  specs: Array<[label: string, value: string]>;
  diagram: ReactNode;
  widthMm: number;
  heightMm: number;
  areaM2: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type QuoteDocumentCompany = {
  legalName?: string;
  bankName?: string;
  bankAccount?: string;
  clabe?: string;
  comercial?: string;
  warranty?: string;
};

export type QuoteDocumentTotals = {
  subtotal: number;
  tax?: number;
  total: number;
  depositPercentage: number;
  depositAmount: number;
  remainingBalance: number;
};

type Props = {
  quoteNumber: string;
  client: string;
  clientAddress?: string;
  project: string;
  quoteDate: string;
  deliveryDate?: string;
  vendorLabel?: string;
  intro: string;
  items: QuoteDocumentItem[];
  totals: QuoteDocumentTotals;
  preliminary?: boolean;
  estimated?: boolean;
  paymentTerms?: string;
  company?: QuoteDocumentCompany;
  showBankDetails?: boolean;
};

const PENDING = "— por configurar —";
const valueOrPending = (value?: string) => value?.trim() || PENDING;

const BUYING_PROCESS = [
  "Revisión de la cotización",
  "Medición profesional",
  "Confirmación del precio",
  "Depósito inicial",
  "Fabricación",
  "Programación de instalación",
  "Instalación y sellado",
];

export function CustomerQuoteDocument({
  quoteNumber,
  client,
  clientAddress,
  project,
  quoteDate,
  deliveryDate,
  vendorLabel,
  intro,
  items,
  totals,
  preliminary = false,
  estimated = false,
  paymentTerms,
  company,
  showBankDetails = false,
}: Props) {
  const pieces = items.reduce((sum, item) => sum + item.quantity, 0);
  const area = items.reduce((sum, item) => sum + item.areaM2 * item.quantity, 0);
  const statusText = preliminary ? "Cotización preliminar" : "Cotización comercial";

  return (
    <article className="quoteDocument reportDoc" aria-label={`Cotización ${quoteNumber}`}>
      <section className="quotePage quoteCoverPage">
        <QuoteHeader vendorLabel={vendorLabel} />

        <div className="quoteTitleRow">
          <div>
            <p className="quoteEyebrow">{statusText}</p>
            <h1>Cotización del cliente</h1>
          </div>
          <span className={`quoteStatus ${preliminary ? "isPreliminary" : ""}`}>{quoteNumber || "Sin folio"}</span>
        </div>

        <div className="quoteMetaGrid">
          <dl>
            <Meta label="Cliente" value={client || "—"} />
            <Meta label="Dirección" value={clientAddress || "—"} />
            <Meta label="Proyecto" value={project || "—"} />
          </dl>
          <dl>
            <Meta label="Cotización" value={quoteNumber || "—"} />
            <Meta label="Fecha" value={quoteDate} />
            <Meta label="Fecha entrega" value={deliveryDate || "Por confirmar"} />
          </dl>
        </div>

        {preliminary && (
          <div className="quotePreliminaryNotice" role="note">
            <b>COTIZACIÓN PRELIMINAR</b>
            <span>Las medidas son referenciales. No realices depósitos hasta que nuestro equipo mida el espacio y confirme el precio.</span>
          </div>
        )}

        <p className="quoteIntro">{intro}</p>

        <div className="quoteItems">
          {items.map((item, index) => (
            <QuoteItem key={item.id} item={item} index={index} />
          ))}
        </div>

        <div className="quoteSummaryGrid">
          <section className="quoteBudget" aria-label="Presupuesto total">
            <h2>Presupuesto total</h2>
            <table>
              <tbody>
                <tr><th>Valor</th><td>{money(totals.subtotal)}</td></tr>
                <tr><th>Descuento</th><td>—</td></tr>
                {typeof totals.tax === "number" && <tr><th>IVA (16%)</th><td>{money(totals.tax)}</td></tr>}
                <tr className="quoteGrandTotal"><th>Total del proyecto</th><td>{money(totals.total)}</td></tr>
              </tbody>
            </table>
            {estimated && <p>Precio aproximado sujeto a revisión y confirmación del asesor.</p>}
          </section>

          <section className="quoteStats" aria-label="Estadísticas del presupuesto">
            <h2>Estadísticas del presupuesto</h2>
            <dl>
              <Meta label="Componentes" value={`${items.length}`} />
              <Meta label="Piezas" value={`${pieces}`} />
              <Meta label="Superficie total" value={`${area.toFixed(3)} m²`} />
            </dl>
          </section>
        </div>

        <QuoteFooter quoteNumber={quoteNumber} project={project} quoteDate={quoteDate} page="01" />
      </section>

      <section className="quotePage quoteTermsPage">
        <QuoteHeader vendorLabel={vendorLabel} compact />
        <div className="quoteTermsTitle">
          <p>LUFT PVC</p>
          <h2>Condiciones comerciales de venta</h2>
        </div>

        {preliminary && (
          <div className="quoteStopNotice">
            <b>COTIZACIÓN PRELIMINAR — NO REALIZAR DEPÓSITOS</b>
            <span>El anticipo mostrado es únicamente informativo hasta recibir la confirmación de nuestro equipo.</span>
          </div>
        )}

        <section className="quoteTermsSection">
          <h3>Proceso de compra e instalación</h3>
          <ol className="quoteProcessList">
            {BUYING_PROCESS.map((step, index) => (
              <li key={step}><span>{index + 1}</span>{step}</li>
            ))}
          </ol>
        </section>

        <section className="quoteTermsSection quotePaymentSection">
          <h3>Condiciones de pago</h3>
          <div className="quotePaymentGrid">
            <div><span>Total del proyecto</span><b>{money(totals.total)}</b></div>
            <div><span>Depósito inicial ({totals.depositPercentage}%)</span><b>{money(totals.depositAmount)}</b></div>
            <div><span>Saldo restante ({100 - totals.depositPercentage}%)</span><b>{money(totals.remainingBalance)}</b></div>
          </div>
          {paymentTerms && <p className="quoteTermCopy">{paymentTerms}</p>}
        </section>

        <section className="quoteTermsSection">
          <h3>Información de pago</h3>
          {showBankDetails ? (
            <dl className="quoteBankGrid">
              <Meta label="Beneficiario" value={valueOrPending(company?.legalName)} />
              <Meta label="Banco" value={valueOrPending(company?.bankName)} />
              <Meta label="Cuenta" value={valueOrPending(company?.bankAccount)} />
              <Meta label="CLABE" value={valueOrPending(company?.clabe)} />
              <Meta label="Referencia" value={`Cotización ${quoteNumber}`} />
            </dl>
          ) : (
            <p className="quoteBankPending">Los datos para pago se entregan de forma segura después de la medición y la confirmación final de la cotización.</p>
          )}
        </section>

        <section className="quoteTermsSection quoteLegalCopy">
          <h3>Alcance, instalación y garantía</h3>
          <p>Los trabajos no especificados en esta cotización se contratarán por separado. No se incluyen trabajos de albañilería ni desmantelamientos salvo que se indiquen expresamente.</p>
          <p>El cliente deberá tener los vanos terminados, accesibles y disponibles en la fecha acordada. La instalación se programa después de confirmar medidas, condiciones del sitio y disponibilidad de fabricación.</p>
          <p><b>Garantía:</b> {showBankDetails ? valueOrPending(company?.warranty) : "Se confirmará junto con las condiciones definitivas del proyecto."}</p>
          <p>La información de esta propuesta es para uso del cliente indicado y no autoriza la reproducción comercial del sistema de cotización.</p>
        </section>

        <div className="quoteSignatures">
          <div><span>{showBankDetails ? `Comercial: ${valueOrPending(company?.comercial)}` : "Asesor LUFT PVC"}</span></div>
          <div><span>Cliente Vo. Bo. / Fecha</span></div>
        </div>

        <QuoteFooter quoteNumber={quoteNumber} project={project} quoteDate={quoteDate} page="02" />
      </section>
    </article>
  );
}

function QuoteItem({ item, index }: { item: QuoteDocumentItem; index: number }) {
  return (
    <section className="quoteItem">
      <h2>{String(index + 1).padStart(3, "0")} - {item.code} · {item.title}</h2>
      <table className="quoteSpecTable">
        <tbody>
          {item.specs.map(([label, value]) => (
            <tr key={label}><th>{label}</th><td>{value || "—"}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="quoteItemVisuals">
        <figure className="quoteDrawing">
          <span className="quoteWidthDim">{item.widthMm.toLocaleString("es-MX")} mm</span>
          <span className="quoteHeightDim">{item.heightMm.toLocaleString("es-MX")} mm</span>
          <div className="quoteDiagram">{item.diagram}</div>
          <figcaption>Vista desde interior</figcaption>
        </figure>
        <div className="quoteCalculated">
          <h3>Valores calculados</h3>
          <dl>
            <Meta label="Precio unitario" value={money(item.unitPrice)} />
            <Meta label="Cantidad" value={`${item.quantity} pza.`} />
            <Meta label="Superficie" value={`${item.areaM2.toFixed(3)} m² c/u`} />
            <Meta label="Valor" value={money(item.lineTotal)} strong />
          </dl>
        </div>
      </div>
    </section>
  );
}

function QuoteHeader({ vendorLabel, compact = false }: { vendorLabel?: string; compact?: boolean }) {
  return (
    <header className={`quoteBrandHeader ${compact ? "isCompact" : ""}`}>
      <div className="quoteLuftLogo" aria-label="LUFT PVC">
        <span>LUFT</span><small>VENTANAS Y PUERTAS DE PVC</small>
      </div>
      <div className="quoteVendorLogo">{vendorLabel || "VENTANAS · PUERTAS · PVC"}</div>
    </header>
  );
}

function QuoteFooter({ quoteNumber, project, quoteDate, page }: { quoteNumber: string; project: string; quoteDate: string; page: string }) {
  return (
    <footer className="quoteFooter">
      <span>LUFT PVC · Cotización profesional</span>
      <b>{page}</b>
      <span>{project} · {quoteNumber} · {quoteDate}</span>
    </footer>
  );
}

function Meta({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div><dt>{label}</dt><dd className={strong ? "isStrong" : ""}>{value}</dd></div>;
}
