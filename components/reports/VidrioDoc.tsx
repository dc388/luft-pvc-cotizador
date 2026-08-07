import { Fragment } from "react";
import type { GlassItem } from "@/types/domain";
import type { QuoteCalc, LeafCalc } from "@/lib/calc";

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

type Props = { calc: QuoteCalc; glass: GlassItem; qty: number; designation: string; location: string };

// Direct port of renderVidrioDoc from static/cotizador.html: the glass order table, grouped
// by the actual glass name each leaf uses (falling back to the general glass when a leaf
// inherits it), each row showing net (cut-down) dimensions.
export function VidrioDoc({ calc, glass, qty, designation, location }: Props) {
  const groups = new Map<string, (LeafCalc & { posIndex: number })[]>();
  calc.leaves.forEach((l, i) => {
    const name = l.spec.glass !== "Heredar vidrio general" ? l.spec.glass : glass.name;
    const list = groups.get(name) ?? [];
    list.push({ ...l, posIndex: i });
    groups.set(name, list);
  });

  let rowNum = 0;
  return (
    <div className="reportDoc">
      <div className="docPage">
        <div className="docHeader">
          <div>
            <div className="docBrandRow">
              <span className="brandMark">L</span>
              <b>LUFT PVC</b>
            </div>
            <h1 className="docTitle">Pedido de vidrio</h1>
          </div>
          <div className="docMeta">
            <div>Proyecto: <b>{designation} · {location}</b></div>
            <div>Fecha: <b>{todayStr()}</b></div>
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
              const groupArea = items.reduce((a, l) => a + l.glassArea * qty, 0);
              return (
                <Fragment key={name}>
                  <tr>
                    <td colSpan={8} style={{ background: "var(--paper)", fontWeight: "bold" }}>
                      {name} — {groupArea.toFixed(3)} m²
                    </td>
                  </tr>
                  {items.map((l) => {
                    rowNum++;
                    const w = Math.max(0, Math.round(l.wMm - 120));
                    const h = Math.max(0, Math.round(l.hMm - 120));
                    return (
                      <tr key={l.id}>
                        <td>{rowNum}</td>
                        <td style={{ textAlign: "center" }}><span className="checkboxCell" /></td>
                        <td>{designation}.{String.fromCharCode(65 + l.posIndex)}</td>
                        <td>{w}</td>
                        <td>{h}</td>
                        <td>{qty}</td>
                        <td>{l.glassArea.toFixed(3)}</td>
                        <td>{(l.glassArea * qty).toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7}>Superficie total</td>
              <td>{(calc.glassArea * qty).toFixed(3)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
