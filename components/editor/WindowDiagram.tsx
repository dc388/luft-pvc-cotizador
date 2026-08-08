import type { ColorItem, FrameNode, System } from "@/types/domain";
import { flattenToLeafFrames } from "@/lib/tree";
import { FrameNodeView } from "./FrameNodeView";
import { CentralLocks } from "./CentralLocks";
import { AssemblyMarcoHits } from "./AssemblyMarcoHits";

type Props = {
  tree: FrameNode;
  width: number;
  height: number;
  color: ColorItem;
  system: System;
};

const noop = () => {};

// Static, non-interactive window diagram used inside printed report documents (Cotización,
// Optimización de corte's frame drawing isn't used but Cotización's item diagram is) — matches
// static/cotizador.html's itemDiagram: no modelStage wrapper (the aspect-ratio lives directly
// on .window via --ar), selectedId="" and showFocus=false so the diagram never reflects
// whatever happens to be selected in the live editor at print time.
export function WindowDiagram({ tree, width, height, color, system }: Props) {
  const light = color.name === "Blanco";
  const frames = flattenToLeafFrames(tree, width, height, system.frameSeatMm, system.centerOverlapMm);
  return (
    <div className={`window ${light ? "whiteFrame" : ""}`} style={{ "--frame": color.hex ?? "#dfe2dc", "--ar": `${width}/${height}` } as React.CSSProperties}>
      {frames.map((frame, i) => (
        <FrameNodeView
          key={frame.id}
          frame={frame}
          overallWidthMm={width}
          overallHeightMm={height}
          zIndex={i + 1}
          selectedId=""
          focusScope="leaf"
          focusPart={null}
          focusSide={null}
          onPartClick={noop}
        />
      ))}
      <CentralLocks tree={tree} widthMm={width} heightMm={height} onCentralLockClick={noop} />
      <AssemblyMarcoHits showFocus={false} focusScope="leaf" focusPart={null} focusSide={null} onClick={noop} />
    </div>
  );
}
