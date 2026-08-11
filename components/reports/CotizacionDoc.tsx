import type { Brand, ColorItem, FrameNode, GlassItem, System } from "@/types/domain";
import type { QuoteCalc } from "@/lib/calc";
import { money } from "@/lib/money";
import { WindowDiagram } from "@/components/editor/WindowDiagram";

// Real commercial terms LUFT PVC already uses in production (seen verbatim across its
// existing RA Workshop-generated quote PDFs) — reused here, not invented.
const COMPANY = {
  legalName: "Loud Ventures SAPI de CV",
  bankName: "BBVA",
  bankAccount: "011 928 0618",
  clabe: "012 180 0011 9280618 4",
  comercial: "Arq. Juan Manuel Saldaña Aguilar",
  warranty: "2 años en Vidrios Condensación y 5 años en decoloración de color al contratar.",
};

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
};

// Direct port of renderCotizacionDoc from static/cotizador.html — the printable client quote,
// including the item diagram (which must never reflect the live editor's current selection,
// see WindowDiagram) and the commercial terms page.
export function CotizacionDoc({ calc, sys, glass, color, brand, tree, width, height, qty, code, designation, location, client, clientAddress, deliveryDate, configSummary }: Props) {
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
        <p className="docIntro">Estimado/a, según sus indicaciones le presentamos la oferta de los productos solicitados. A continuación, el desglose de cada elemento:</p>
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
          <div><span>COMPONENTES</span><b>1 pza.</b></div>
          <div><span>SUPERFICIE TOTAL</span><b>{(calc.area * qty).toFixed(3)} m²</b></div>
        </div>
      </div>
      <div className="docPage docPageBreak">
        <div className="docTerms">
          <h4>Condiciones comerciales de venta</h4>
          <p>(La vista de la cancelería es vista por dentro)</p>
          <p><b>Forma de pago:</b></p>
          <p>
            A) 70% al momento de aprobación y firma del presente Contrato/Presupuesto.
            <br />
            B) 40% al aviso de embarque de cancelería o vidrio.
          </p>
          <p>En caso de aceptación del proyecto, favor de efectuar los pagos mediante depósito a:</p>
          <div className="docBank">
            <div>Titular: <b>{COMPANY.legalName}</b></div>
            <div>{COMPANY.bankName}: <b>{COMPANY.bankAccount}</b></div>
            <div>CLABE: <b>{COMPANY.clabe}</b></div>
          </div>
          <p>
            La ejecución de trabajos no especificados en esta cotización deberá contratarse por separado. No se incluyen trabajos de albañilería ni
            desmantelamientos. Se solicita al cliente tener al 100% los vanos terminados y disponibles para el montaje en la fecha acordada. Estos
            precios incluyen instalación, la cual se realiza hasta que todos los vanos estén listos para montaje.
          </p>
          <p><b>Garantía:</b> {COMPANY.warranty}</p>
          <p>Esta oferta es propiedad de {COMPANY.legalName}; no debe reproducirse ni entregarse a terceros sin consentimiento.</p>
          <div className="docSignatures">
            <div>Comercial: {COMPANY.comercial}</div>
            <div>Cliente Vo.Bo. / Fecha</div>
          </div>
        </div>
      </div>
    </div>
  );
}
