import type { FocusScope } from "@/types/domain";
import { SIDES, SIDE_LABELS, type PartKind, type SideKey } from "./frameTypes";

type Props = {
  // false for the static report diagram -- the report must never reflect whatever happens
  // to be selected in the live editor at the moment it's printed.
  showFocus: boolean;
  focusScope: FocusScope;
  focusPart: PartKind | null;
  focusSide: SideKey | null;
  onClick: (side: SideKey) => void;
};

export function AssemblyMarcoHits({ showFocus, focusScope, focusPart, focusSide, onClick }: Props) {
  const isFocused = (side: SideKey) => showFocus && focusScope === "assembly" && focusPart === "marco" && focusSide === side;
  return (
    <>
      {SIDES.map((side) => (
        <button
          key={side}
          type="button"
          className={`hitAssemblyMarco hitAssemblyMarco${side[0].toUpperCase()}${side.slice(1)} ${isFocused(side) ? "marcoSideFocus" : ""}`}
          title={`Marco de conjunto · Lado ${SIDE_LABELS[side]}`}
          aria-label={`Marco de conjunto - Lado ${SIDE_LABELS[side]}`}
          onClick={() => onClick(side)}
        />
      ))}
    </>
  );
}
