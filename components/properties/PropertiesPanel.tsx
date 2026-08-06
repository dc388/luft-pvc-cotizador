"use client";

import type { PaneSpec, WingType } from "@/types/domain";
import { glassCatalog } from "@/data/glass";
import { wingDefs } from "@/data/wings";

type Props = {
  wing: WingType;
  spec: PaneSpec;
  dims: { wMm: number; hMm: number } | null;
  canMerge: boolean;
  onChange: (key: keyof PaneSpec, value: string) => void;
  onMerge: () => void;
};

export function PropertiesPanel({ wing, spec, dims, canMerge, onChange, onMerge }: Props) {
  const wingName = wingDefs.find((w) => w.id === wing)?.name ?? wing;
  return (
    <div className="componentEditor">
      <div className="componentTitle">
        <span>COMPONENTE SELECCIONADO</span>
        <b>{wingName}</b>
        <small>{dims ? `${Math.round(dims.wMm)} × ${Math.round(dims.hMm)} mm` : ""}</small>
      </div>
      <div className="componentGrid">
        <label>Estado
          <select value={spec.state} onChange={(e) => onChange("state", e.target.value)}>
            <option>Fija</option><option>Móvil</option><option>Inactiva</option>
          </select>
        </label>
        <label>Tipo de apertura
          <select value={spec.opening} onChange={(e) => onChange("opening", e.target.value)}>
            <option>Sin apertura</option><option>Corredera</option><option>Abatible interior</option><option>Abatible exterior</option><option>Oscilobatiente</option><option>Proyectante</option>
          </select>
        </label>
        <label>Dirección
          <select value={spec.direction} onChange={(e) => onChange("direction", e.target.value)}>
            <option>N/A</option><option>Derecha</option><option>Izquierda</option><option>Interior</option><option>Exterior</option>
          </select>
        </label>
        <label>Vidrio
          <select value={spec.glass} onChange={(e) => onChange("glass", e.target.value)}>
            <option>Heredar vidrio general</option>
            {glassCatalog.map((x) => <option key={x.name}>{x.name}</option>)}
          </select>
        </label>
        <label className="wide">Herraje
          <select value={spec.hardware} onChange={(e) => onChange("hardware", e.target.value)}>
            <option>Sin herraje</option><option>Roto · juego corredera</option><option>Roto · carros 80 kg</option><option>Roto · carros 120 kg</option><option>Roto · cierre multipunto</option><option>Roto Patio · osciloparalela</option><option>Bisagras reforzadas</option>
          </select>
        </label>
        <label className="wide">Manilla / cierre
          <select value={spec.handle} onChange={(e) => onChange("handle", e.target.value)}>
            <option>Sin manilla</option><option>Harmony con tetones</option><option>Slim 479092 con tetones</option><option>Cierre embutido</option><option>Manillón doble</option><option>Cremona multipunto</option>
          </select>
        </label>
        <label className="wide">Observaciones
          <textarea value={spec.notes} onChange={(e) => onChange("notes", e.target.value)} placeholder="Mecanizado, altura de manilla, restricciones..." />
        </label>
      </div>
      <p className="componentNote">Selecciona carros, cierres y manillas según el peso del vidrio, tamaño de hoja y geometría del perfil.</p>
      {canMerge && <button type="button" className="fullButton" onClick={onMerge}>Combinar con hoja vecina <span>×</span></button>}
    </div>
  );
}
