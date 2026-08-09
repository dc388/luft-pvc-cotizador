import type { ProcessStepId } from "@/data/processSteps";

// Iconografía de línea, en SVG inline. Sin librería de iconos y sin fotografía: son unos pocos
// trazos por paso, así que cualquier paquete externo pesaría más que todo este archivo y
// añadiría una dependencia para algo que el navegador ya sabe dibujar.
//
// Todo usa `currentColor`, de modo que el color lo decide el CSS (los tokens --cg-*) y no cada
// icono. Son decorativos: van con aria-hidden y el significado siempre está en el texto de al
// lado, nunca solo en el dibujo.

const svg = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Ilustración grande de cada paso. Reemplazable por fotografía real sin tocar el resto. */
export function StepIllustration({ id }: { id: ProcessStepId }) {
  return (
    <svg viewBox="0 0 64 48" className="procArt" aria-hidden="true" {...svg}>
      {id === "revision" && (
        <>
          <rect x="14" y="8" width="26" height="32" rx="3" />
          <path d="M20 17h14M20 23h14M20 29h8" />
          <circle cx="44" cy="32" r="8" />
          <path d="M40.5 32l2.5 2.5 4.5-5" />
        </>
      )}
      {id === "medicion" && (
        <>
          <rect x="10" y="10" width="28" height="28" rx="2" />
          <path d="M24 10v28" />
          <path d="M46 12v24M43 12h6M43 36h6" />
          <path d="M46 20h6M46 28h6" />
        </>
      )}
      {id === "precio" && (
        <>
          <path d="M12 26L26 12h14a4 4 0 014 4v14L30 44a3 3 0 01-4 0L12 30a3 3 0 010-4z" />
          <circle cx="38" cy="20" r="2.6" />
          <path d="M25 30l3 3 7-7" />
        </>
      )}
      {id === "deposito" && (
        <>
          <rect x="8" y="14" width="30" height="20" rx="3" />
          <path d="M8 21h30M14 28h6" />
          <path d="M48 12l9 4v8c0 6-4 9.6-9 11-5-1.4-9-5-9-11v-8z" />
          <path d="M44.5 24l2.5 2.5 5-5.5" />
        </>
      )}
      {id === "fabricacion" && (
        <>
          <rect x="8" y="16" width="24" height="24" rx="2" />
          <path d="M20 16v24" />
          <circle cx="46" cy="20" r="6" />
          <path d="M46 10v3M46 27v3M55 20h-3M40 20h-3M52.4 13.6l-2 2M42 24l-2 2M52.4 26.4l-2-2M42 16l-2-2" />
          <path d="M38 40h18" />
        </>
      )}
      {id === "agenda" && (
        <>
          <rect x="12" y="10" width="34" height="30" rx="3" />
          <path d="M12 19h34M21 7v6M37 7v6" />
          <circle cx="24" cy="27" r="1.4" />
          <circle cx="32" cy="27" r="1.4" />
          <circle cx="40" cy="27" r="4" />
          <path d="M38.2 27l1.3 1.3 2.4-2.6" />
        </>
      )}
      {id === "instalacion" && (
        <>
          <rect x="10" y="9" width="30" height="30" rx="2" />
          <path d="M25 9v30M10 24h30" />
          <path d="M48 14v10M43 19h10" />
          <circle cx="48" cy="34" r="7" />
          <path d="M44.8 34l2.2 2.2 4.2-4.6" />
        </>
      )}
    </svg>
  );
}

// Tres iconos que se reparten las cápsulas de apoyo por posición. La variedad es visual: el
// texto de la cápsula es el que comunica.
const CHIP_ICONS = [
  <path key="check" d="M5 12.5l4 4 10-11" />,
  <path key="shield" d="M12 3l7 3v6c0 4.6-3 7.4-7 8.6C8 19.4 5 16.6 5 12V6z" />,
  <>
    <circle key="dot" cx="12" cy="12" r="8" />
    <path key="tick" d="M8.5 12.2l2.4 2.4 4.6-5" />
  </>,
];

export function ChipIcon({ index }: { index: number }) {
  return (
    <svg viewBox="0 0 24 24" className="procChipIcon" aria-hidden="true" {...svg}>
      {CHIP_ICONS[index % CHIP_ICONS.length]}
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="procTickIcon" aria-hidden="true" {...svg}>
      <path d="M5 12.5l4 4 10-11" />
    </svg>
  );
}
