import type { FrameNode } from "@/types/domain";
import { buildCutList, packBars, BAR_LENGTH_MM, KERF_MM, type CutPiece } from "@/lib/calc";

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function CorteCategory({ title, pieces, qty }: { title: string; pieces: CutPiece[]; qty: number }) {
  if (!pieces.length) return null;
  const allPieces: CutPiece[] = [];
  for (let i = 0; i < qty; i++) allPieces.push(...pieces);
  const bars = packBars(allPieces, BAR_LENGTH_MM, KERF_MM);
  const totalWaste = bars.reduce((a, b) => a + b.waste, 0);
  const totalUsed = bars.reduce((a, b) => a + b.used, 0);
  const wastePct = totalUsed + totalWaste > 0 ? (totalWaste / (totalUsed + totalWaste)) * 100 : 0;
  return (
    <div className="cutGroup">
      <div className="cutGroupHead">
        <b>{title}</b>
        <span>{bars.length} barra(s) de {BAR_LENGTH_MM} mm · {wastePct.toFixed(1)}% desperdicio</span>
      </div>
      {bars.map((bar, bi) => (
        <div className="cutBarRow" key={bi}>
          <div className="cutBarLabel">
            <span>Barra {bi + 1} · {BAR_LENGTH_MM} mm</span>
            <span>Resto: {Math.round(bar.waste)} mm</span>
          </div>
          <div className="cutBar">
            {bar.pieces.map((p, pi) => (
              <div key={pi} className="cutBarPiece" style={{ flex: `${p.length} 0 0%`, background: pi % 2 === 0 ? "var(--accent)" : "#14231c" }} title={`${p.label} · ${p.length} mm · ${p.angle}`}>
                {p.length}
              </div>
            ))}
            {bar.waste > 0 && <div className="cutBarWaste" style={{ flex: `${bar.waste} 0 0%` }}>{Math.round(bar.waste)}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

type Props = { tree: FrameNode; width: number; height: number; qty: number; designation: string; location: string };

// Direct port of renderCorteDoc from static/cotizador.html: the real cut-list optimizer
// document, grouped by piece category (Marco/Travesaño/Hoja/Junquillo), each bin-packed
// independently onto BAR_LENGTH_MM commercial bars via packBars (first-fit-decreasing).
export function CorteDoc({ tree, width, height, qty, designation, location }: Props) {
  const cut = buildCutList(tree, width, height);
  return (
    <div className="reportDoc">
      <div className="docPage">
        <div className="docHeader">
          <div>
            <div className="docBrandRow">
              <span className="brandMark">L</span>
              <b>LUFT PVC</b>
            </div>
            <h1 className="docTitle">Optimización del corte</h1>
          </div>
          <div className="docMeta">
            <div>Proyecto: <b>{designation} · {location}</b></div>
            <div>Fecha: <b>{todayStr()}</b></div>
            <div>Tolerancia: <b>{KERF_MM} mm</b></div>
          </div>
        </div>
        <CorteCategory title="Marco" pieces={cut.marco} qty={qty} />
        <CorteCategory title="Travesaño" pieces={cut.travesanos} qty={qty} />
        <CorteCategory title="Hoja" pieces={cut.hojas} qty={qty} />
        <CorteCategory title="Junquillo" pieces={cut.junquillos} qty={qty} />
        <p className="docIntro">
          Barra comercial de {BAR_LENGTH_MM} mm, tolerancia de corte de {KERF_MM} mm entre piezas. Optimización por primer ajuste descendente
          (first-fit-decreasing); valida ángulos, soldadura y reglas específicas del catálogo antes de fabricar.
        </p>
      </div>
    </div>
  );
}
