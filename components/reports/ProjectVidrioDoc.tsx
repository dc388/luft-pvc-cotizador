import { Fragment } from "react";
import type { ComponentRecord } from "@/types/project";
import { glassCatalog } from "@/data/glass";
import { calcForComponent } from "@/lib/projectReports";

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

type Props = { components: ComponentRecord[]; projectName: string };

type Row = { designation: string; posIndex: number; w: number; h: number; qty: number; glassArea: number };

// Direct port of renderProjectVidrioDoc from static/cotizador.html — one glass order covering
// every component, grouped by the actual glass name each leaf uses (same rule as VidrioDoc).
export function ProjectVidrioDoc({ components, projectName }: Props) {
  const groups = new Map<string, Row[]>();
  components.forEach((c) => {
    const calc = calcForComponent(c);
    const glassName = glassCatalog[c.data.glassIndex].name;
    calc.leaves.forEach((l, i) => {
      const name = l.spec.glass !== "Heredar vidrio general" ? l.spec.glass : glassName;
      const list = groups.get(name) ?? [];
      list.push({
        designation: c.designation,
        posIndex: i,
        // Misma fuente que el costeo: data/glazing.ts vía LeafCalc.
        w: Math.round(l.glassWMm),
        h: Math.round(l.glassHMm),
        qty: c.qty,
        glassArea: l.glassArea,
      });
      groups.set(name, list);
    });
  });

  let rowNum = 0;
  let grandArea = 0;
  return (
    <div className="reportDoc">
      <div className="docPage">
        <div className="docHeader">
          <div>
            <div className="docBrandRow">
              <span className="brandMark">L</span>
              <b>LUFT PVC</b>
            </div>
            <h1 className="docTitle">Pedido de vidrio — Proyecto completo</h1>
          </div>
          <div className="docMeta">
            <div>Proyecto: <b>{projectName}</b></div>
            <div>Fecha: <b>{todayStr()}</b></div>
            <div>Componentes: <b>{components.length}</b></div>
          </div>
        </div>
        <table className="docTable">
          <thead>
            <tr>
              <th>No.</th>
              <th></th>
              <th>Posición</th>
              <th>W (mm)</th>
              <th>H (mm)</th>
              <th>Cant.</th>
              <th>m²</th>
              <th>m² total</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(groups.entries()).map(([name, items]) => {
              const groupArea = items.reduce((a, l) => a + l.glassArea * l.qty, 0);
              return (
                <Fragment key={name}>
                  <tr>
                    <td colSpan={8} style={{ background: "var(--paper)", fontWeight: "bold" }}>
                      {name} — {groupArea.toFixed(3)} m²
                    </td>
                  </tr>
                  {items.map((l, li) => {
                    rowNum++;
                    const area = l.glassArea * l.qty;
                    grandArea += area;
                    return (
                      <tr key={li}>
                        <td>{rowNum}</td>
                        <td style={{ textAlign: "center" }}><span className="checkboxCell" /></td>
                        <td>{l.designation}.{String.fromCharCode(65 + l.posIndex)}</td>
                        <td>{l.w}</td>
                        <td>{l.h}</td>
                        <td>{l.qty}</td>
                        <td>{l.glassArea.toFixed(3)}</td>
                        <td>{area.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7}>Superficie total del proyecto</td>
              <td>{grandArea.toFixed(3)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
