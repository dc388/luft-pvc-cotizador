"use client";

import type { ProcessStep } from "@/data/processSteps";
import { GlassCard, GlassChip, GlassNumber, Reveal } from "./Glass";
import { ChipIcon, StepIllustration } from "./ProcessIcons";

// Una card por paso del proceso, con la misma anatomía de las referencias visuales: número
// grande en cápsula, título, texto corto, ilustración a un lado y tres cápsulas de apoyo abajo.
//
// `extra` deja inyectar contenido calculado en servidor (el desglose del anticipo en el paso 4)
// sin que este componente sepa nada de precios.
export function GlassProcessStep({ step, extra }: { step: ProcessStep; extra?: React.ReactNode }) {
  return (
    <Reveal>
      <GlassCard className="procStep">
        <div className="procHead">
          <GlassNumber n={step.n} />
          <div className="procHeadText">
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
          <div className="procArtBox" aria-hidden="true">
            <StepIllustration id={step.id} />
          </div>
        </div>

        {extra}

        {step.note && <p className="cotNote procNote">{step.note}</p>}

        <div className="procChips">
          {step.chips.map((chip, i) => (
            <GlassChip key={chip} icon={<ChipIcon index={i} />}>
              {chip}
            </GlassChip>
          ))}
        </div>
      </GlassCard>
    </Reveal>
  );
}
