import type { Brand, ColorItem, FrameNode, GlassItem, System } from "@/types/domain";
import type { QuoteCalc } from "@/lib/calc";
import { money } from "@/lib/money";
import { WindowDiagram } from "@/components/editor/WindowDiagram";

// Los datos fiscales, bancarios y comerciales llegan como prop desde el servidor
// (lib/companySettings.ts, resuelto en app/page.tsx). Antes vivían aquí como constante, lo que
// dejaba la CLABE en el repositorio y en todo el historial de git.
import type { CompanySettings } from "@/lib/companySettings";

// Marcador visible cuando un dato de empresa no está configurado. Deliberadamente evidente:
// un valor de respaldo plausible es justo lo que haría que una cotización saliera con datos
// bancarios equivocados sin que nadie lo note.
const PENDIENTE = "— por configurar —";
const orPending = (value: string) => value || PENDIENTE;

function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

type Props = {
  calc: QuoteCalc;
  sys: System;
  glass: GlassItem;
  color: ColorItem;
  brand: Brand;
  tree: FrameNode;
  width: number;
  height: number;
  qty: number;
  code: string;
  designation: string;
  location: string;
  client: string;
  clientAddress: string;
  deliveryDate: string;
  configSummary: string;
  /** Falls back to the historical hardcoded copy when a component predates these editable fields. */
  termsHeader?: string;
  paymentTerms?: string;
  /** Resuelto en servidor (app/page.tsx) -- este componente nunca lo lee por su cuenta. */
  company: CompanySettings;
};

const DEFAULT_TERMS_HEADER = "Estimado/a, según sus indicaciones le presentamos la oferta de los productos solicitados. A continuación, el desglose de cada elemento:";
const DEFAULT_PAYMENT_TERMS = "A) 70% al momento de aprobación y firma del presente Contrato/Presupuesto.\nB) 30% al aviso de embarque de cancelería o vidrio.";

// Direct port of renderCotizacionDoc from static/cotizador.html — the printable client quote,
// including the item diagram (which must never reflect the live editor's current selection,
// see WindowDiagram) and the commercial terms page.
export function CotizacionDoc({ calc, sys, glass, color, brand, tree, width, height, qty, code, designation, location, client, clientAddress, deliveryDate, configSummary, termsHeader, paymentTerms, company }: Props) {
  const specRows: [string, string][] = [
    ["Dimensiones", `${width.toLocaleString()} mm × ${height.toLocaleString()} mm`],
    ["Perfil del sistema", `${brand} - ${sys.name} / ${color.name}`],
    ["Configuración", configSummary],
    ["Fittings", `Herrajes ${brand} (Con instalación)`],
    ["Vidrio", glass.name],
    ["Cantidad", `${qty} pza.`],
  ];
  const iva = calc.total * 0.16;
  return (
    <div className="reportDoc">
      <div className="docPage">
        <div className="docHeader">
          <div>
            <div className="docBrandRow">
              <span className="brandMark">L</span>
              <b>LUFT PVC</b>
            </div>
            <h1 className="docTitle">Cotización del cliente</h1>
          </div>
          <div className="docMeta">
            <div>Cliente: <b>{client || "—"}</b></div>
            <div>Dirección: <b>{clientAddress || "—"}</b></div>
            <div>Proyecto: <b>{designation} · {location}</b></div>
            <div>Fecha: <b>{todayStr()}</b></div>
            <div>Entrega: <b>{fmtDate(deliveryDate)}</b></div>
          </div>
        </div>
        <p className="docIntro">{termsHeader || DEFAULT_TERMS_HEADER}</p>
        <div className="docItem">
          <div className="docItemHead">{code} — Componente {designation}</div>
          <div className="docItemBody">
            <table className="docSpecTable">
              <tbody>
                {specRows.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="docDiagramBox">
              <WindowDiagram tree={tree} width={width} height={height} color={color} system={sys} />
            </div>
          </div>
        </div>
        <table className="docTable">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Cant.</th>
              <th>Precio unitario</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{designation} · {calc.area.toFixed(3)} m² c/u</td>
              <td>{qty} pza.</td>
              <td>{money(calc.sale)}</td>
              <td>{money(calc.total)}</td>
            </tr>
          </tbody>
        </table>
        <div className="docTotalRow"><span>Subtotal</span><b>{money(calc.total)}</b></div>
        <div className="docTotalRow"><span>IVA (16%)</span><b>{money(iva)}</b></div>
        <div className="docTotalRow grand"><span>Presupuesto total</span><b>{money(calc.total + iva)}</b></div>
        <div className="docStatGrid">
          <div><span>COMPONENTES</span><b>{qty} pza.</b></div>
          <div><span>SUPERFICIE TOTAL</span><b>{(calc.area * qty).toFixed(3)} m²</b></div>
        </div>
      </div>
      <div className="docPage docPageBreak">
        <div className="docTerms">
          <h4>Condiciones comerciales de venta</h4>
          <p>(La vista de la cancelería es vista por dentro)</p>
          <p><b>Forma de pago:</b></p>
          <p>
            {(paymentTerms || DEFAULT_PAYMENT_TERMS).split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
          <p>En caso de aceptación del proyecto, favor de efectuar los pagos mediante depósito a:</p>
          <div className="docBank">
            <div>Titular: <b>{orPending(company.legalName)}</b></div>
            <div>{orPending(company.bankName)}: <b>{orPending(company.bankAccount)}</b></div>
            <div>CLABE: <b>{orPending(company.clabe)}</b></div>
          </div>
          <p>
            La ejecución de trabajos no especificados en esta cotización deberá contratarse por separado. No se incluyen trabajos de albañilería ni
            desmantelamientos. Se solicita al cliente tener al 100% los vanos terminados y disponibles para el montaje en la fecha acordada. Estos
            precios incluyen instalación, la cual se realiza hasta que todos los vanos estén listos para montaje.
          </p>
          <p><b>Garantía:</b> {orPending(company.warranty)}</p>
          <p>Esta oferta es propiedad de {orPending(company.legalName)}; no debe reproducirse ni entregarse a terceros sin consentimiento.</p>
          <div className="docSignatures">
            <div>Comercial: {orPending(company.comercial)}</div>
            <div>Cliente Vo.Bo. / Fecha</div>
          </div>
        </div>
      </div>
    </div>
  );
}
