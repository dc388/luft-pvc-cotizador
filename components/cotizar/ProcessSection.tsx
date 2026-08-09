"use client";

import { processSteps } from "@/data/processSteps";
import { money } from "@/lib/money";
import { GlassCard, Reveal } from "./glass/Glass";
import { GlassProcessStep } from "./glass/GlassProcessStep";
import { GlassTimeline } from "./glass/GlassTimeline";

type Deposit = { total: number; depositPercentage: number; deposit: number; remaining: number } | null;

// "¿Qué sigue después de tu cotización?" -- los 7 pasos del proceso más el timeline de 9
// etapas, antes de que el cliente mande sus datos.
//
// Una card por paso en columna: en móvil eso ya es el scroll vertical que pide el brief, y en
// escritorio la columna centrada se lee mejor que 7 cards en fila (que obligarían a encogerlas
// hasta volver ilegible el texto). Cada card se revela al entrar al viewport.
export function ProcessSection({ deposit }: { deposit: Deposit }) {
  return (
    <div className="procSection">
      {processSteps.map((step) => (
        <GlassProcessStep
          key={step.id}
          step={step}
          extra={step.id === "deposito" ? <DepositBreakdown deposit={deposit} /> : undefined}
        />
      ))}

      <Reveal>
        <GlassCard className="procTimelineCard">
          <h3>El recorrido completo</h3>
          <p className="cotHint">Podrás consultar en qué etapa va tu proyecto.</p>
          {/* currentIndex fijo en 0 mientras el backend no guarde estado (fase 2). */}
          <GlassTimeline currentIndex={0} />
        </GlassCard>
      </Reveal>
    </div>
  );
}

// Los tres importes vienen calculados del servidor (lib/companySettings.ts -> splitDeposit).
// Aquí solo se formatean: el navegador no multiplica porcentajes ni decide saldos.
function DepositBreakdown({ deposit }: { deposit: Deposit }) {
  if (!deposit) return null;
  return (
    <GlassCard variant="tinted" className="procDeposit">
      <div className="procDepositRow">
        <span>Total del proyecto</span>
        <b>{money(deposit.total)}</b>
      </div>
      <div className="procDepositRow procDepositRowMain">
        <span>Depósito inicial ({deposit.depositPercentage}%)</span>
        <b>{money(deposit.deposit)}</b>
      </div>
      <div className="procDepositRow">
        <span>Saldo restante ({100 - deposit.depositPercentage}%)</span>
        <b>{money(deposit.remaining)}</b>
      </div>
    </GlassCard>
  );
}
