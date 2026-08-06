import type { Brand, Report } from "@/types/domain";
import type { QuoteCalc } from "@/lib/calc";
import { wingDefs } from "@/data/wings";
import { money } from "@/lib/money";

type Props = {
  report: Report;
  code: string;
  designation: string;
  location: string;
  brand: Brand;
  system: string;
  qty: number;
  width: number;
  height: number;
  glassName: string;
  calc: QuoteCalc;
};

function configSummary(calc: QuoteCalc) {
  const names = Array.from(new Set(calc.leaves.map((l) => wingDefs.find((w) => w.id === l.wing)?.name ?? l.wing)));
  return names.join(" + ");
}

export function ReportPreview({ report, code, designation, location, brand, system, qty, width, height, glassName, calc }: Props) {
  return (
    <div className="reportPreview">
      <header>
        <span>LUFT PVC · {report.toUpperCase()}</span>
        <b>{code} / {designation}</b>
        <small>{location} · {brand} · {system}</small>
      </header>
      {report === "Vidrio" ? (
        <>
          <h3>Orden de vidrio</h3>
          <table>
            <thead><tr><th>Pos.</th><th>Descripción</th><th>Cant.</th><th>Medidas</th><th>m²</th></tr></thead>
            <tbody>
              {calc.leaves.map((l, i) => (
                <tr key={l.id}>
                  <td>{designation}.{String.fromCharCode(65 + i)}</td>
                  <td>{l.spec.glass !== "Heredar vidrio general" ? l.spec.glass : glassName}</td>
                  <td>{qty}</td>
                  <td>{Math.max(0, Math.round(l.wMm - 120))} × {Math.max(0, Math.round(l.hMm - 120))}</td>
                  <td>{(l.glassArea * qty).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th colSpan={4}>Superficie total</th><th>{(calc.glassArea * qty).toFixed(3)}</th></tr></tfoot>
          </table>
        </>
      ) : report === "Perfiles" ? (
        <>
          <h3>Orden total de perfiles</h3>
          <ReportRow a="Marco / riel" b={`${(calc.frameM * qty).toFixed(2)} m`} c={`${Math.ceil((calc.frameM * qty) / 6)} barras`} />
          <ReportRow a="Perfil de hoja" b={`${(calc.sashM * qty).toFixed(2)} m`} c={`${Math.ceil((calc.sashM * qty) / 6)} barras`} />
          <ReportRow a="Refuerzo" b={`${((calc.frameM + calc.sashM) * qty).toFixed(2)} m`} c="Galvanizado" />
        </>
      ) : report === "Herrajes" ? (
        <>
          <h3>Accesorios y herrajes</h3>
          <ReportRow a="Juego de herrajes" b={`${calc.leaves.length * qty} set`} c={configSummary(calc)} />
          <ReportRow a="Juntas EPDM" b={`${((calc.frameM + calc.sashM) * qty).toFixed(2)} m`} c="Perimetral" />
          <ReportRow a="Calzos / topes" b={`${calc.leaves.length * 4 * qty} pza`} c="Según vidrio" />
          {calc.addons > 0 && <ReportRow a="Persiana Mallorquina" b={money(calc.addons * qty)} c="Accesorio exterior" />}
        </>
      ) : report === "Producción" ? (
        <>
          <h3>Orden de producción</h3>
          <ReportRow a="Elemento" b={`${qty} pza`} c={`${width} × ${height} mm`} />
          <ReportRow a="Configuración" b={configSummary(calc)} c={`${calc.leaves.length} hoja(s)`} />
          <ReportRow a="Vidrio" b={glassName} c={`${calc.leaves.length} paño(s)`} />
          <ReportRow a="Control" b="Medidas y diagonales" c="Pendiente" />
        </>
      ) : report === "Costos" ? (
        <>
          <h3>Estadística del proyecto</h3>
          <ReportRow a="Perfiles" b={money(calc.profileCost * qty)} c="MXN" />
          <ReportRow a="Vidrio" b={money(calc.glassCost * qty)} c="MXN" />
          <ReportRow a="Herrajes y accesorios" b={money(calc.accessories * qty)} c="MXN" />
          <ReportRow a="Costo directo" b={money(calc.direct * qty)} c="MXN" />
          <ReportRow a="Total oferta" b={money(calc.total)} c="MXN" />
        </>
      ) : (
        <>
          <h3>Oferta para cliente</h3>
          <ReportRow a={`${designation} · ${location}`} b={`${qty} pza`} c={`${width} × ${height} mm`} />
          <ReportRow a={brand} b={system} c={configSummary(calc)} />
          <ReportRow a="Total" b={money(calc.total)} c="IVA no incluido" />
        </>
      )}
    </div>
  );
}

export function ReportRow({ a, b, c }: { a: string; b: string; c: string }) {
  return <div className="reportRow"><span>{a}</span><b>{b}</b><small>{c}</small></div>;
}
