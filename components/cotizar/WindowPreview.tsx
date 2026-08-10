import type { WingType } from "@/types/domain";

type Props = {
  panels?: number;
  wings?: WingType[];
  widthMm: number;
  heightMm: number;
  frameHex: string;
  glassName?: string;
  label?: string;
};

// Representación comercial derivada de las aperturas reales del catálogo. No reutiliza el
// editor técnico ni expone perfiles o costos internos: solo proporción, hojas, color y vidrio.
export function WindowPreview({ panels = 1, wings, widthMm, heightMm, frameHex, glassName = "", label }: Props) {
  const ratio = widthMm > 0 && heightMm > 0 ? widthMm / heightMm : 1.5;
  const light = isLight(frameHex);
  const paneWings = wings?.length ? wings : Array.from({ length: panels }, () => "fixed" as WingType);
  const glassTone = /doble|dvh/i.test(glassName)
    ? "double"
    : /laminado/i.test(glassName)
      ? "laminated"
      : /seguridad|templado/i.test(glassName)
        ? "security"
        : "clear";

  return (
    <div
      className="cotPreview"
      style={{ aspectRatio: String(ratio) }}
      role="img"
      aria-label={label ?? `Vista previa de ${paneWings.length} ${paneWings.length === 1 ? "hoja" : "hojas"}`}
    >
      <div className="cotPreviewFrame" style={{ background: frameHex, borderColor: light ? "#00000022" : "#ffffff22" }}>
        {paneWings.map((wing, index) => (
          <div className="cotPreviewPane" key={`${wing}-${index}`} style={{ borderColor: frameHex }}>
            <span className="cotPreviewGlass" data-glass={glassTone} />
            <OpeningMark wing={wing} index={index} count={paneWings.length} />
          </div>
        ))}
      </div>
    </div>
  );
}

function OpeningMark({ wing, index, count }: { wing: WingType; index: number; count: number }) {
  if (wing === "fixed" || wing === "inactive" || wing === "sliding-fixed") return null;

  if (wing === "sliding" || wing === "lift-slide" || wing === "folding-sliding") {
    return (
      <svg className="cotPreviewOpening" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M18 50h64M30 38 18 50l12 12M70 38l12 12-12 12" />
      </svg>
    );
  }

  if (wing === "project" || wing === "hopper") {
    return (
      <svg className="cotPreviewOpening" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M12 14 50 84 88 14M28 30h44" />
      </svg>
    );
  }

  if (wing === "door") {
    // En una puerta doble las bisagras quedan hacia los extremos y las manijas al centro.
    // Una puerta sencilla conserva la orientación de la referencia: bisagras a la izquierda.
    const mirror = count > 1 && index === count - 1;
    return (
      <svg className="cotPreviewOpening" viewBox="0 0 100 100" aria-hidden="true">
        <g transform={mirror ? "translate(100 0) scale(-1 1)" : undefined}>
          <path d="M12 10 86 50 12 90M12 20v14M12 66v14M80 50h10" />
          <circle cx="80" cy="50" r="2.5" />
        </g>
      </svg>
    );
  }

  return (
    <svg className="cotPreviewOpening" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M12 10 86 50 12 90" />
      {wing === "tilt-turn" && <path d="M12 10 50 84 88 10" />}
    </svg>
  );
}

function isLight(hex: string): boolean {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return true;
  const value = parseInt(match[1], 16);
  const [red, green, blue] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return (red * 299 + green * 587 + blue * 114) / 1000 > 140;
}
