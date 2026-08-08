import type { ComponentRecord } from "@/types/project";
import { calcForComponent } from "@/lib/projectReports";
import { money } from "@/lib/money";

function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

type Props = { components: ComponentRecord[]; projectName: string; client: string; clientAddress: string; deliveryDate: string };

// Direct port of renderProjectCotizacionDoc from static/cotizador.html — one client quote
// covering every component in the project, each priced with its own materials/system.
export function ProjectCotizacionDoc({ components, projectName, client, clientAddress, deliveryDate }: Props) {
  const rows = components.map((c) => ({ c, calc: calcForComponent(c) }));
  const total = rows.reduce((a, r) => a + r.calc.total, 0);
  const iva = total * 0.16;
  return (
    <div className="reportDoc">
      <div className="docPage">
        <div className="docHeader">
          <div>
            <div className="docBrandRow">
              <span className="brandMark">L</span>
              <b>LUFT PVC</b>
            </div>
            <h1 className="docTitle">Cotización — Proyecto completo</h1>
          </div>
          <div className="docMeta">
            <div>Cliente: <b>{client || "—"}</b></div>
            <div>Proyecto: <b>{projectName}</b></div>
            <div>Fecha: <b>{todayStr()}</b></div>
            <div>Entrega: <b>{fmtDate(deliveryDate)}</b></div>
          </div>
        </div>
        {clientAddress && <p className="docIntro">Dirección: {clientAddress}</p>}
        <table className="docTable">
          <thead>
            <tr>
              <th>Código</th>
              <th>Posición</th>
              <th>Ubicación</th>
              <th>Medida</th>
              <th>Cant.</th>
              <th>Precio unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, calc }) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.designation}</td>
                <td>{c.location}</td>
                <td>{c.widthMm}×{c.heightMm} mm</td>
                <td>{c.qty}</td>
                <td>{money(calc.sale)}</td>
                <td>{money(calc.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="docTotalRow"><span>Subtotal proyecto</span><b>{money(total)}</b></div>
        <div className="docTotalRow"><span>IVA (16%)</span><b>{money(iva)}</b></div>
        <div className="docTotalRow grand"><span>Presupuesto total del proyecto</span><b>{money(total + iva)}</b></div>
      </div>
    </div>
  );
}
