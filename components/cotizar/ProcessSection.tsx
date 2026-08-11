"use client";

import { processSteps } from "@/data/processSteps";
import { GlassCard, Reveal } from "./glass/Glass";
import { GlassProcessStep } from "./glass/GlassProcessStep";
import { GlassTimeline } from "./glass/GlassTimeline";

// "¿Qué sigue después de tu cotización?" -- los 7 pasos del proceso más el timeline de 9
// etapas, antes de que el cliente mande sus datos.
//
// Ya no lleva el desglose del anticipo. Mostraba total, depósito y saldo, y eran los últimos
// importes que quedaban en el recorrido de configuración: ahora el anticipo se explica como paso
// del proceso y sus cifras aparecen en las condiciones de pago del documento definitivo.
//
// Una card por paso en columna: en móvil eso ya es el scroll vertical que pide el brief, y en
// escritorio la columna centrada se lee mejor que 7 cards en fila (que obligarían a encogerlas
// hasta volver ilegible el texto). Cada card se revela al entrar al viewport.
export function ProcessSection() {
  return (
    <div className="procSection">
      {processSteps.map((step) => (
        <GlassProcessStep key={step.id} step={step} />
      ))}

      <Reveal>
        <GlassCard className="procTimelineCard">
          <h3>El recorrido completo</h3>
          <p className="cotHint">Podrás consultar en qué etapa va tu proyecto.</p>
          {/* currentIndex fijo en 0: la etapa real vive en el expediente interno (quotes.status)
              y todavía no hay un enlace por el que el cliente pueda consultarla. */}
          <GlassTimeline currentIndex={0} />
        </GlassCard>
      </Reveal>
    </div>
  );
}
