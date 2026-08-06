"use client";

import type { PaneSpec, WingType } from "@/types/domain";
import { glassCatalog } from "@/data/glass";
import { wingDefs } from "@/data/wings";

const OPENING_OPTIONS = Array.from(new Set(["Sin apertura", "Corredera", "Corredera elevadora", "Plegable corrediza", "Abatible interior", "Abatible exterior", "Oscilobatiente", "Proyectante", "Proyectante inferior", "Persiana de cristal", "Pivotante"]));
const HARDWARE_OPTIONS = ["Sin herraje", "Roto · juego corredera", "Roto · carros 80 kg", "Roto · carros 120 kg", "Roto · cierre multipunto", "Roto Patio · osciloparalela", "Roto · sistema elevador (lift-slide)", "Bisagra pivote reforzada", "Bisagras reforzadas"];
const HANDLE_OPTIONS = ["Sin manilla", "Harmony con tetones", "Slim 479092 con tetones", "Cierre embutido", "Manillón doble", "Cremona multipunto", "Manivela jalousie"];

type Props = {
  wing: WingType;
  spec: PaneSpec;
  dims: { wMm: number; hMm: number } | null;
  canMerge: boolean;
  onChange: (key: keyof PaneSpec, value: string | boolean) => void;
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
            {OPENING_OPTIONS.map((o) => <option key={o}>{o}</option>)}
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
            {HARDWARE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="wide">Manilla / cierre
          <select value={spec.handle} onChange={(e) => onChange("handle", e.target.value)}>
            {HANDLE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="wide" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 7 }}>
          <input type="checkbox" checked={spec.mallorquina} onChange={(e) => onChange("mallorquina", e.target.checked)} style={{ width: "auto", height: "auto" }} />
          Persiana Mallorquina exterior (lamas orientables, accesorio de sombra)
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
