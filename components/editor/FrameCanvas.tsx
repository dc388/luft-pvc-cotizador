"use client";

import type { MouseEvent } from "react";
import type { FrameNode } from "@/types/domain";
import { FrameNodeView } from "./FrameNodeView";

type Props = {
  tree: FrameNode;
  width: number;
  height: number;
  selectedId: string;
  colorName: string;
  onLeafClick: (id: string, e: MouseEvent<HTMLButtonElement>) => void;
};

export function FrameCanvas({ tree, width, height, selectedId, colorName, onLeafClick }: Props) {
  const light = colorName === "Blanco";
  return (
    <div className={`window ${light ? "whiteFrame" : ""}`}>
      <FrameNodeView
        node={tree}
        widthMm={width}
        heightMm={height}
        selectedId={selectedId}
        flexBasis="1 1 100%"
        onLeafClick={onLeafClick}
      />
    </div>
  );
}
