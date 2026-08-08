"use client";

import type { Tool, WingType } from "@/types/domain";
import { wingDefs } from "@/data/wings";

type Props = {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  canMerge: boolean;
  onMerge: () => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

// Floating tool palette over the design canvas, modeled on RA Workshop's
// Splitters/Wings categories: pick a tool, then click a pane in FrameCanvas
// to apply it (see handleLeafClick in app/page.tsx).
export function Toolbox({ activeTool, onToolChange, canMerge, onMerge, onReset, canUndo, canRedo, onUndo, onRedo }: Props) {
  const isSplit = (axis: "row" | "col") => activeTool.mode === "split" && activeTool.axis === axis;
  const isWing = (w: WingType) => activeTool.mode === "assign-wing" && activeTool.wing === w;

  return (
    <aside className="toolbox">
      <div className="toolboxGroup">
        <span>Divisores</span>
        <div className="toolboxGrid">
          <button type="button" className={isSplit("col") ? "active" : ""} title="Dividir en columnas" onClick={() => onToolChange({ mode: "split", axis: "col" })}>⫲</button>
          <button type="button" className={isSplit("row") ? "active" : ""} title="Dividir en filas" onClick={() => onToolChange({ mode: "split", axis: "row" })}>⫳</button>
        </div>
      </div>
      <div className="toolboxGroup">
        <span>Tipo de hoja</span>
        <div className="toolboxGrid">
          {wingDefs.map((w) => (
            <button key={w.id} type="button" className={isWing(w.id) ? "active" : ""} title={w.name} onClick={() => onToolChange({ mode: "assign-wing", wing: w.id })}>{w.icon}</button>
          ))}
        </div>
      </div>
      <div className="toolboxGroup">
        <button type="button" className="toolboxAction" disabled={activeTool.mode === "select"} onClick={() => onToolChange({ mode: "select" })}>Modo selección</button>
        <button type="button" className="toolboxAction" disabled={!canMerge} onClick={onMerge}>Combinar hojas</button>
        <button type="button" className="toolboxAction" onClick={onReset}>Reiniciar diseño</button>
      </div>
      <div className="toolboxGroup">
        <div className="toolboxGrid">
          <button type="button" className="toolboxAction" title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>↶</button>
          <button type="button" className="toolboxAction" title="Rehacer (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>↷</button>
        </div>
      </div>
    </aside>
  );
}
