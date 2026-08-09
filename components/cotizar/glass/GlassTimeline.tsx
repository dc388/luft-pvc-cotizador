"use client";

import { timelineStages } from "@/data/processSteps";
import { CheckIcon } from "./ProcessIcons";

// Timeline de las 9 etapas del proyecto.
//
// `currentIndex` es la etapa en curso; todo lo anterior se marca como cumplido. Hoy siempre
// llega 0 ("Cotización creada") porque el backend todavía no guarda estado -- ver la fase 2 de
// PROCESO_POST_COTIZACION.md. Cuando exista, esta prop es lo único que cambia: la lista de
// etapas ya vive en data/processSteps.ts, no aquí.
//
// Accesibilidad: es una lista ordenada real, con aria-current en la etapa activa y el estado
// dicho con palabras para quien no ve el color ni la palomita.
export function GlassTimeline({ currentIndex = 0 }: { currentIndex?: number }) {
  return (
    <ol className="glassTimeline">
      {timelineStages.map((stage, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const state = done ? "done" : current ? "current" : "pending";
        return (
          <li key={stage.id} className={`glassTimelineItem is-${state}`} aria-current={current ? "step" : undefined}>
            <span className="glassTimelineMark" aria-hidden="true">
              {done ? <CheckIcon /> : <i className="glassTimelineDot" />}
            </span>
            <span className="glassTimelineLabel">
              {stage.label}
              <small>{done ? "Completado" : current ? "En curso" : "Pendiente"}</small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
