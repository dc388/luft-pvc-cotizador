"use client";

import type { Tool, WingType } from "@/types/domain";
import { wingDefs } from "@/data/wings";
import { MergeIcon, ResetIcon, SelectToolIcon, SplitColsIcon, SplitRowsIcon, WingIcon } from "./icons";

type Props = {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  canMerge: boolean;
  onMerge: () => void;
  onReset: () => void;
};

// Floating tool palette over the design canvas, modeled on RA Workshop's
// Splitters/Wings categories: pick a tool, then click a pane in FrameCanvas
// to apply it (see handleLeafClick in app/page.tsx).
export function Toolbox({ activeTool, onToolChange, canMerge, onMerge, onReset }: Props) {
  const isSplit = (axis: "row" | "col") => activeTool.mode === "split" && activeTool.axis === axis;
  const isWing = (w: WingType) => activeTool.mode === "assign-wing" && activeTool.wing === w;
  const isSelect = activeTool.mode === "select";

  return (
    <aside className="toolbox">
      <div className="toolboxGroup">
        <span>Divisores</span>
        <div className="toolboxGrid">
          <button
            type="button"
            className={isSplit("col") ? "active" : ""}
            title="Dividir en columnas — clic en una hoja para partirla verticalmente"
            aria-pressed={isSplit("col")}
            onClick={() => onToolChange({ mode: "split", axis: "col" })}
          >
            <SplitColsIcon />
          </button>
          <button
            type="button"
            className={isSplit("row") ? "active" : ""}
            title="Dividir en filas — clic en una hoja para partirla horizontalmente"
            aria-pressed={isSplit("row")}
            onClick={() => onToolChange({ mode: "split", axis: "row" })}
          >
            <SplitRowsIcon />
          </button>
        </div>
      </div>
      <div className="toolboxGroup">
        <span>Tipo de hoja</span>
        <div className="toolboxGrid">
          {wingDefs.map((w) => (
            <button
              key={w.id}
              type="button"
              className={isWing(w.id) ? "active" : ""}
              title={`${w.name} — clic en una hoja para asignarla`}
              aria-pressed={isWing(w.id)}
              onClick={() => onToolChange({ mode: "assign-wing", wing: w.id })}
            >
              <WingIcon id={w.id} />
            </button>
          ))}
        </div>
      </div>
      <div className="toolboxGroup">
        <button
          type="button"
          className={`toolboxAction ${isSelect ? "active" : ""}`}
          disabled={isSelect}
          title="Modo selección — clic en cualquier parte del dibujo para inspeccionarla"
          onClick={() => onToolChange({ mode: "select" })}
        >
          <SelectToolIcon /> Modo selección
        </button>
        <button type="button" className="toolboxAction" disabled={!canMerge} title="Combinar las dos hojas del corte seleccionado en una sola" onClick={onMerge}>
          <MergeIcon /> Combinar hojas
        </button>
        <button type="button" className="toolboxAction" title="Volver al diseño de 2 hojas correderas por defecto" onClick={onReset}>
          <ResetIcon /> Reiniciar diseño
        </button>
      </div>
    </aside>
  );
}
