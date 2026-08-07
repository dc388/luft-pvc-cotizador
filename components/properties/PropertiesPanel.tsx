"use client";

import type { GlassSide, LeafNode, PaneSpec, Side } from "@/types/domain";
import { glassCatalog } from "@/data/glass";
import { wingName, MOVABLE_SLIDING_WINGS, SIDE_LABEL } from "@/lib/tree";
import type { PartKind, SideKey } from "@/components/editor/frameTypes";
import { NumberInput } from "@/components/NumberInput";

const OPENING_OPTIONS = Array.from(
  new Set([
    "Sin apertura",
    "Corredera",
    "Corredera elevadora",
    "Plegable corrediza",
    "Corredera fija (sin apertura)",
    "Abatible interior",
    "Abatible exterior",
    "Oscilobatiente",
    "Proyectante",
    "Proyectante inferior",
    "Persiana de cristal",
    "Pivotante",
  ])
);
const HARDWARE_OPTIONS = ["Sin herraje", "Roto · juego corredera", "Roto · carros 80 kg", "Roto · carros 120 kg", "Roto · cierre multipunto", "Roto Patio · osciloparalela", "Roto · sistema elevador (lift-slide)", "Bisagra pivote reforzada", "Bisagras reforzadas"];
const HANDLE_OPTIONS = ["Sin manilla", "Harmony con tetones", "Slim 479092 con tetones", "Cierre embutido", "Manillón doble", "Cremona multipunto", "Manivela jalousie"];
const POCKET_OPTIONS = ["Ninguno", "Bolsillo sencillo", "Bolsillo doble"];

type Props = {
  leaf: LeafNode;
  dims: { wMm: number; hMm: number } | null;
  focusPart: PartKind | null;
  focusSide: SideKey | null;
  canMerge: boolean;
  onChange: (key: keyof PaneSpec, value: string | boolean | number) => void;
  onChangeSide: (side: SideKey, patch: Partial<Side>) => void;
  onChangeGlassSide: (side: SideKey, patch: Partial<GlassSide>) => void;
  onMerge: () => void;
};

export function PropertiesPanel({ leaf, dims, focusPart, focusSide, canMerge, onChange, onChangeSide, onChangeGlassSide, onMerge }: Props) {
  const spec = leaf.spec;
  const cls = (part: PartKind) => (focusPart === part ? "partFocus" : "");
  const sideSpec = focusPart === "marco" && focusSide ? spec.sides[focusSide] : null;
  const glassSideSpec = focusPart === "vidrio" && focusSide ? spec.glassSides[focusSide] : null;
  const isMovableSliding = MOVABLE_SLIDING_WINGS.includes(leaf.wing);
  const hasSash = leaf.wing !== "fixed" && leaf.wing !== "inactive" && leaf.wing !== "sliding-fixed";

  return (
    <div className="componentEditor">
      <div className="componentTitle">
        <span>
          COMPONENTE SELECCIONADO{focusPart ? ` · ${focusPart.toUpperCase()}` : ""}
          {(sideSpec || glassSideSpec) && focusSide ? ` · LADO ${SIDE_LABEL[focusSide].toUpperCase()}` : ""}
        </span>
        <b>{wingName(leaf.wing)}</b>
        <small>{dims ? `${Math.round(dims.wMm)} × ${Math.round(dims.hMm)} mm` : ""}</small>
      </div>

      {sideSpec && focusSide && (
        <div className="sideEditor">
          <b>Lado — {SIDE_LABEL[focusSide]}</b>
          <label className="checkRow">
            <input type="checkbox" checked={sideSpec.reinforcement} onChange={(e) => onChangeSide(focusSide, { reinforcement: e.target.checked })} />
            Refuerzo galvanizado en este lado
          </label>
          <label>
            Notas de este lado
            <textarea
              value={sideSpec.notes}
              placeholder="Mecanizado, drenaje, restricciones de este lado..."
              onChange={(e) => onChangeSide(focusSide, { notes: e.target.value })}
            />
          </label>
        </div>
      )}

      {glassSideSpec && focusSide && (
        <div className="sideEditor">
          <b>Vidrio · Lado — {SIDE_LABEL[focusSide]}</b>
          <div className="componentGrid">
            <label>
              Ángulo 1
              <NumberInput value={glassSideSpec.angulo1} onChange={(n) => onChangeGlassSide(focusSide, { angulo1: n })} />
            </label>
            <label>
              Ángulo 2
              <NumberInput value={glassSideSpec.angulo2} onChange={(n) => onChangeGlassSide(focusSide, { angulo2: n })} />
            </label>
            <label>
              Radio
              <NumberInput value={glassSideSpec.radio} onChange={(n) => onChangeGlassSide(focusSide, { radio: n })} />
            </label>
            <label>
              Altura del arco
              <NumberInput value={glassSideSpec.arco} onChange={(n) => onChangeGlassSide(focusSide, { arco: n })} />
            </label>
          </div>
          <label>
            Notas de este lado
            <textarea value={glassSideSpec.notes} placeholder="Corte especial, bisel, forma..." onChange={(e) => onChangeGlassSide(focusSide, { notes: e.target.value })} />
          </label>
        </div>
      )}

      <div className="componentGrid">
        <label className={cls("marco")}>
          Estado
          <select value={spec.state} onChange={(e) => onChange("state", e.target.value)}>
            <option>Fija</option>
            <option>Móvil</option>
            <option>Inactiva</option>
          </select>
        </label>
        <label className={cls("hoja")}>
          Tipo de apertura
          <select value={spec.opening} onChange={(e) => onChange("opening", e.target.value)}>
            {OPENING_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className={cls("hoja")}>
          Dirección
          <select value={spec.direction} onChange={(e) => onChange("direction", e.target.value)}>
            <option>N/A</option>
            <option>Derecha</option>
            <option>Izquierda</option>
            <option>Interior</option>
            <option>Exterior</option>
          </select>
        </label>
        <label className={cls("vidrio")}>
          Vidrio
          <select value={spec.glass} onChange={(e) => onChange("glass", e.target.value)}>
            <option>Heredar vidrio general</option>
            {glassCatalog.map((x) => (
              <option key={x.name}>{x.name}</option>
            ))}
          </select>
        </label>
        <label className={`wide ${cls("herraje")}`}>
          Herraje
          <select value={spec.hardware} onChange={(e) => onChange("hardware", e.target.value)}>
            {HARDWARE_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className={`wide ${cls("herraje")}`}>
          Manilla / cierre
          <select value={spec.handle} onChange={(e) => onChange("handle", e.target.value)}>
            {HANDLE_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className="wide checkRow">
          <input type="checkbox" checked={spec.mallorquina} onChange={(e) => onChange("mallorquina", e.target.checked)} />
          Persiana Mallorquina exterior (lamas orientables, accesorio de sombra)
        </label>
        {isMovableSliding && (
          <>
            <label className={cls("herraje")}>
              Tipo de bolsillo
              <select value={spec.pocketType} onChange={(e) => onChange("pocketType", e.target.value)}>
                {POCKET_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label className={`checkRow ${cls("herraje")}`}>
              <input type="checkbox" checked={spec.useGancho} onChange={(e) => onChange("useGancho", e.target.checked)} />
              Utilizar gancho
            </label>
            <label className={`checkRow ${cls("herraje")}`}>
              <input type="checkbox" checked={spec.useAdaptador} onChange={(e) => onChange("useAdaptador", e.target.checked)} />
              Utilizar adaptador
            </label>
          </>
        )}
        {hasSash && (
          <label className={cls("herraje")}>
            Posición de manilla (mm)
            <NumberInput value={spec.handlePosition} onChange={(n) => onChange("handlePosition", n)} />
          </label>
        )}
        <label className="wide">
          Observaciones
          <textarea value={spec.notes} onChange={(e) => onChange("notes", e.target.value)} placeholder="Mecanizado, altura de manilla, restricciones..." />
        </label>
      </div>
      <p className="componentNote">
        Selecciona carros, cierres y manillas según el peso del vidrio, tamaño de hoja y geometría del perfil. Haz clic directamente en el marco, la
        hoja, el vidrio o el herraje del dibujo para saltar aquí — el marco se divide en 4 lados independientes (arriba/abajo/izquierda/derecha).
      </p>
      {canMerge && (
        <button type="button" className="fullButton" onClick={onMerge}>
          Combinar con hoja vecina <span>×</span>
        </button>
      )}
    </div>
  );
}
