type Props = { panels: number; widthMm: number; heightMm: number; frameHex: string };

// Dibujo simple del vano para el cliente: proporción real (ancho/alto), color de marco
// elegido y una hoja por panel. No es el render técnico de la app interna (components/editor)
// -- aquí solo hace falta que el cliente reconozca lo que está comprando.
export function WindowPreview({ panels, widthMm, heightMm, frameHex }: Props) {
  const ratio = widthMm > 0 && heightMm > 0 ? widthMm / heightMm : 1.5;
  const light = isLight(frameHex);
  return (
    <div className="cotPreview" style={{ aspectRatio: String(ratio) }}>
      <div className="cotPreviewFrame" style={{ background: frameHex, borderColor: light ? "#00000022" : "#ffffff22" }}>
        {Array.from({ length: panels }, (_, i) => (
          <div className="cotPreviewPane" key={i} style={{ borderColor: frameHex }}>
            <span className="cotPreviewGlass" />
          </div>
        ))}
      </div>
    </div>
  );
}

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}
