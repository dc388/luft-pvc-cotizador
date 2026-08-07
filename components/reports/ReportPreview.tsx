import type { Report } from "@/types/domain";
import type { QuoteCalc } from "@/lib/calc";
import { money } from "@/lib/money";

type Props = {
  report: Report;
  code: string;
  designation: string;
  location: string;
  brand: string;
  system: string;
  qty: number;
  width: number;
  height: number;
  glassName: string;
  configSummary: string;
  calc: QuoteCalc;
};

// Fallback informal report preview for the 3 report kinds that don't have a fully modernized
// printable document (Producción/Herrajes/Costos) — Cotización/Optimización de
// corte/Pedido de vidrio use CotizacionDoc/CorteDoc/VidrioDoc instead, see app/page.tsx.
export function ReportPreview({ report, code, designation, location, brand, system, qty, width, height, glassName, configSummary, calc }: Props) {
  return (
    <div className="reportPreview">
      <header>
        <span>LUFT PVC · {report.toUpperCase()}</span>
        <b>{code} / {designation}</b>
        <small>{location} · {brand} · {system}</small>
      </header>
      {report === "Herrajes" ? (
        <>
          <h3>Accesorios y herrajes</h3>
          <ReportRow a="Juego de herrajes" b={`${calc.leaves.length * qty} set`} c={configSummary} />
          <ReportRow a="Juntas EPDM" b={`${((calc.frameM + calc.sashM) * qty).toFixed(2)} m`} c="Perimetral" />
          <ReportRow a="Calzos / topes" b={`${calc.leaves.length * 4 * qty} pza`} c="Según vidrio" />
          {calc.addons > 0 && <ReportRow a="Persiana Mallorquina" b={money(calc.addons * qty)} c="Accesorio exterior" />}
        </>
      ) : report === "Producción" ? (
        <>
          <h3>Orden de producción</h3>
          <ReportRow a="Elemento" b={`${qty} pza`} c={`${width} × ${height} mm`} />
          <ReportRow a="Configuración" b={configSummary} c={`${calc.leaves.length} hoja(s)`} />
          <ReportRow a="Vidrio" b={glassName} c={`${calc.leaves.length} paño(s)`} />
          <ReportRow a="Control" b="Medidas y diagonales" c="Pendiente" />
        </>
      ) : (
        <>
          <h3>Estadística del proyecto</h3>
          <ReportRow a="Perfiles" b={money(calc.profileCost * qty)} c="MXN" />
          <ReportRow a="Vidrio" b={money(calc.glassCost * qty)} c="MXN" />
          <ReportRow a="Herrajes y accesorios" b={money(calc.accessories * qty)} c="MXN" />
          <ReportRow a="Costo directo" b={money(calc.direct * qty)} c="MXN" />
          <ReportRow a="Total oferta" b={money(calc.total)} c="MXN" />
        </>
      )}
    </div>
  );
}

export function ReportRow({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <div className="reportRow">
      <span>{a}</span>
      <b>{b}</b>
      <small>{c}</small>
    </div>
  );
}
