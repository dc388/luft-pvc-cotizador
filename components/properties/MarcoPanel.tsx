"use client";

import type { Marco, Side } from "@/types/domain";
import { SIDE_LABEL } from "@/lib/tree";
import type { SideKey } from "@/components/editor/frameTypes";

type Props = {
  marco: Marco;
  focusSide: SideKey | null;
  onChange: (patch: Partial<Marco>) => void;
  onChangeSide: (side: SideKey, patch: Partial<Side>) => void;
};

// Properties panel for the assembly-level marco (state.marco) — the marco of the whole
// opening, independent of each leaf's own marco. Ported from renderMarcoPanel in
// static/cotizador.html.
export function MarcoPanel({ marco: m, focusSide: fs, onChange, onChangeSide }: Props) {
  const sideSpec = fs ? m.sides[fs] : null;
  return (
    <div className="componentEditor">
      <div className="componentTitle">
        <span>COMPONENTE SELECCIONADO · MARCO DE CONJUNTO{fs ? ` · LADO ${SIDE_LABEL[fs].toUpperCase()}` : ""}</span>
        <b>Marco</b>
        <small>Vano completo</small>
      </div>
      {sideSpec && fs && (
        <div className="sideEditor">
          <b>Lado — {SIDE_LABEL[fs]}</b>
          <label className="checkRow">
            <input type="checkbox" checked={sideSpec.reinforcement} onChange={(e) => onChangeSide(fs, { reinforcement: e.target.checked })} />
            Refuerzo galvanizado en este lado
          </label>
          <label>
            Notas de este lado
            <textarea
              value={sideSpec.notes}
              placeholder="Mecanizado, drenaje, restricciones de este lado..."
              onChange={(e) => onChangeSide(fs, { notes: e.target.value })}
            />
          </label>
        </div>
      )}
      <div className="componentGrid">
        <label className="wide">
          Perfil - código
          <input type="text" value={m.profileCode} placeholder="Catálogo real: pendiente (ver Fase 2)" onChange={(e) => onChange({ profileCode: e.target.value })} />
        </label>
        <label className="checkRow">
          <input type="checkbox" checked={m.reinforcement} onChange={(e) => onChange({ reinforcement: e.target.checked })} />
          Reforzamiento
        </label>
        <label>
          Código de refuerzo
          <input type="text" value={m.reinforcementCode} disabled={!m.reinforcement} onChange={(e) => onChange({ reinforcementCode: e.target.value })} />
        </label>
        <label className="checkRow">
          <input type="checkbox" checked={m.mosquitero} onChange={(e) => onChange({ mosquitero: e.target.checked })} />
          Mosquitero
        </label>
        <label>
          Código de mosquitero
          <input type="text" value={m.mosquiteroCode} disabled={!m.mosquitero} onChange={(e) => onChange({ mosquiteroCode: e.target.value })} />
        </label>
        <label className="checkRow">
          <input type="checkbox" checked={m.persiana} onChange={(e) => onChange({ persiana: e.target.checked })} />
          Persiana
        </label>
        <label>
          Código de persiana
          <input type="text" value={m.persianaCode} disabled={!m.persiana} onChange={(e) => onChange({ persianaCode: e.target.value })} />
        </label>
      </div>
      <p className="componentNote">
        Marco de conjunto: el marco de todo el vano, independiente del marco de cada hoja. Haz clic en cualquiera de sus 4 lados (el borde exterior
        grueso del dibujo) o en &quot;Marco&quot; en el explorador.
      </p>
    </div>
  );
}
