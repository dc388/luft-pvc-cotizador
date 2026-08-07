import type { FrameNode } from "@/types/domain";
import { flattenToRects, SLIDING_WINGS } from "@/lib/tree";

type Props = {
  tree: FrameNode;
  widthMm: number;
  heightMm: number;
  onCentralLockClick: (id: string) => void;
};

// A 4-leaf sliding group meeting at its middle run gets a central lock (cierre central) instead
// of a mullion — matches real corredera hardware. Splits are always binary, so a flat run of 4
// sliding leaves can end up as any nesting shape; scanning the flattened, x-sorted rects finds
// the true visual center (boundary between leaf 2 and 3 of any contiguous 4-sliding run)
// regardless of how the tree happens to be nested.
export function CentralLocks({ tree, widthMm, heightMm, onCentralLockClick }: Props) {
  const rects = [...flattenToRects(tree, widthMm, heightMm)].sort((a, b) => a.x - b.x);
  const markers = [];
  for (let i = 0; i + 3 < rects.length; i++) {
    const run = rects.slice(i, i + 4);
    const sameRow = run.every((r) => Math.abs(r.y - run[0].y) < 0.01 && Math.abs(r.h - run[0].h) < 0.01);
    const contiguous = run.every((r, idx) => idx === 0 || Math.abs(r.x - (run[idx - 1].x + run[idx - 1].w)) < 0.01);
    const allSliding = run.every((r) => SLIDING_WINGS.includes(r.wing));
    if (sameRow && contiguous && allSliding) {
      const centerX = run[1].x + run[1].w;
      markers.push(
        <button
          key={run[2].id}
          type="button"
          className="cierreCentral"
          title="Cierre central"
          style={{ left: `${((centerX / widthMm) * 100).toFixed(3)}%` }}
          onClick={() => onCentralLockClick(run[2].id)}
        >
          ⚿
        </button>
      );
    }
  }
  return <>{markers}</>;
}
