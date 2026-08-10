import type { WingType } from "@/types/domain";
import { WindowPreview } from "./WindowPreview";

type Props = {
  styleName: string;
  wings: WingType[];
  widthMm: number;
  heightMm: number;
  qty: number;
  frameHex: string;
  colorName: string;
  glassName: string;
};

export function LiveQuotePreview({ styleName, wings, widthMm, heightMm, qty, frameHex, colorName, glassName }: Props) {
  return (
    <aside className="cotLivePreview" aria-label="Vista previa en vivo de tu diseño">
      <div className="cotLivePreviewHead">
        <span><i aria-hidden="true" /> Vista previa en vivo</span>
        <b>{styleName}</b>
      </div>
      <WindowPreview
        wings={wings}
        widthMm={widthMm}
        heightMm={heightMm}
        frameHex={frameHex}
        glassName={glassName}
        label={`${styleName}, ${widthMm} por ${heightMm} milímetros, color ${colorName}`}
      />
      <div className="cotLivePreviewMeta">
        <span>{widthMm.toLocaleString("es-MX")} × {heightMm.toLocaleString("es-MX")} mm</span>
        <span>{colorName}</span>
        <span>{glassName}</span>
        {qty > 1 && <span>{qty} piezas</span>}
      </div>
      <small>Representación aproximada. Un especialista verificará medidas y detalles antes de fabricar.</small>
    </aside>
  );
}
