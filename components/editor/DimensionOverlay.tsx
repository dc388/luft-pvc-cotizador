// Real CAD-style dimension lines for the 2D canvas: extension line + end ticks + a floating
// value chip, positioned directly against the actual rendered window box (a sibling inside
// .modelStage, whose box is pixel-identical to .window's — see FrameCanvas). Unlike the old
// fixed-position placeholder divs (.dim.top/.dim.side, previously in app/page.tsx), these live
// inside the pan/zoom transform layer, so they track the drawing precisely at any zoom level,
// the way a width/height annotation follows the model in AutoCAD/Revit.
type Props = { widthMm: number; heightMm: number };

export function DimensionOverlay({ widthMm, heightMm }: Props) {
  return (
    <>
      <div className="dimLine dimLineTop" aria-hidden="true">
        <span className="dimTick dimTickLeft" />
        <span className="dimTick dimTickRight" />
        <span className="dimValue">{Math.round(widthMm).toLocaleString()} mm</span>
      </div>
      <div className="dimLine dimLineSide" aria-hidden="true">
        <span className="dimTick dimTickTop" />
        <span className="dimTick dimTickBottom" />
        <span className="dimValue">{Math.round(heightMm).toLocaleString()} mm</span>
      </div>
    </>
  );
}
