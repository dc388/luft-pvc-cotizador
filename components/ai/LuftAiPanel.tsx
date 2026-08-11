"use client";

import { useState } from "react";
import type { ComponentRecord, ComponentSummary } from "@/types/project";
import type { LuftAgentState } from "@/types/luft-ai";
import {
  applyApprovedChanges,
  decidePendingChanges,
  hasPermission,
  interpretPrompt,
  luftDirector,
  recordAgentResult,
  recordAppliedChanges,
  type AgentContext,
  type LuftActor,
} from "@/lib/luft-ai";

type Props = {
  actor: LuftActor;
  projectId: string;
  projectName: string;
  component: ComponentRecord;
  componentSummaries: ComponentSummary[];
  state: LuftAgentState;
  onStateChange: (state: LuftAgentState) => void;
  onApply: (component: ComponentRecord, state: LuftAgentState) => void;
  signedIn: boolean;
};

const CONFIDENCE_LABEL = { high: "Alta", medium: "Media", low: "Baja", blocked: "Bloqueada" } as const;

export function LuftAiPanel({ actor, projectId, projectName, component, componentSummaries, state, onStateChange, onApply, signedIn }: Props) {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("Puedo revisar el componente y preparar cambios técnicos para tu aprobación.");
  const canReview = hasPermission(actor.role, "component:review");
  const canApprove = hasPermission(actor.role, "component:approve");

  const context = (): AgentContext => ({
    actor,
    projectId,
    projectName,
    component,
    componentSummaries,
    now: new Date().toISOString(),
  });

  const runTask = (text: string) => {
    if (!canReview) {
      setReply("Este rol solo puede consultar el proyecto. Inicia sesión con una cuenta técnica para ejecutar agentes.");
      return;
    }
    const interpreted = interpretPrompt(text, context());
    if (!interpreted.ok) {
      setReply(interpreted.question);
      return;
    }
    const result = luftDirector.run(context(), interpreted.task);
    const next = recordAgentResult(state, result, actor, component.id, interpreted.task.intent);
    onStateChange(next);
    setReply(result.payload?.summary ?? "La ejecución no produjo un resultado aplicable.");
    setPrompt("");
  };

  const runReview = () => runTask("Revisa técnicamente el componente actual");

  const decide = (changeId: string, decision: "approved" | "rejected") => {
    if (!canApprove) {
      setReply("Tu rol no puede aprobar cambios técnicos.");
      return;
    }
    const decided = decidePendingChanges(state, [changeId], decision, actor);
    if (decision === "rejected") {
      onStateChange(decided);
      setReply("Propuesta rechazada; el componente no fue modificado.");
      return;
    }
    const approved = decided.pendingChanges.find((change) => change.id === changeId && change.approval === "approved");
    if (!approved) {
      setReply("La propuesta está bloqueada o ya no puede aprobarse.");
      return;
    }
    const applied = applyApprovedChanges(component, [approved]);
    if (applied.applied.length === 0) {
      onStateChange(decided);
      setReply(applied.rejected[0]?.reason ?? "El motor no pudo aplicar la propuesta.");
      return;
    }
    const recorded = recordAppliedChanges(decided, applied.applied, actor);
    onApply(applied.component, recorded);
    setReply("Cambio aplicado. Sus dependencias quedan DIRTY hasta ejecutar una nueva revisión.");
  };

  const lastRun = state.lastRun;
  const pending = state.pendingChanges.filter((change) => change.approval === "pending");
  const dirtyCount = Object.values(state.fieldStates).filter((field) => field.status === "dirty").length;
  const blockedCount = Object.values(state.fieldStates).filter((field) => field.status === "blocked").length;

  return (
    <section className="luftAiPanel" aria-label="LUFT AI">
      <header className="luftAiHeader">
        <div>
          <span className="luftAiKicker">ORQUESTACIÓN TÉCNICA</span>
          <h2><i>✦</i> LUFT AI</h2>
        </div>
        <div className="luftAiStatus">
          <span className={blockedCount ? "blocked" : "ready"}>{blockedCount ? `${blockedCount} bloqueos` : "Listo"}</span>
          <small>{dirtyCount} DIRTY · rev. {state.revision}</small>
        </div>
      </header>

      <p className="luftAiReply">{reply}</p>
      {!signedIn && actor.role === "viewer" && (
        <p className="luftAiAuth">La ejecución y aprobación requieren identidad técnica. <a href="/signin-with-chatgpt?return_to=%2F">Iniciar sesión</a></p>
      )}

      <div className="luftAiComposer">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder='Ejemplo: “Cambia el ancho a 3200”'
          rows={3}
          disabled={!canReview}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runTask(prompt);
          }}
        />
        <div>
          <button type="button" onClick={runReview} disabled={!canReview}>Revisar componente</button>
          <button type="button" className="primary" onClick={() => runTask(prompt)} disabled={!canReview || !prompt.trim()}>Preparar cambio</button>
        </div>
      </div>

      <div className="luftAiAgents" aria-label="Agentes de Fase 1">
        {["Director", "Diseño", "Perfiles", "Vidrio", "Herrajes"].map((name, index) => (
          <span key={name} className={index === 0 ? "director" : ""}><b>{index === 0 ? "✦" : "●"}</b>{name}</span>
        ))}
      </div>

      {lastRun && (
        <div className="luftAiRun">
          <header>
            <strong>{lastRun.summary}</strong>
            <span className={`confidence ${lastRun.confidence.level}`}>{CONFIDENCE_LABEL[lastRun.confidence.level]}</span>
          </header>
          {lastRun.findings.length > 0 && (
            <ul className="luftAiFindings">
              {lastRun.findings.slice(0, 8).map((item) => (
                <li key={item.id} className={item.blocking ? "blocking" : item.severity}>
                  <b>{item.blocking ? "Bloqueo" : item.severity === "warning" ? "Aviso" : "Dato"}</b>
                  <span>{item.title}</span>
                  <p>{item.message}</p>
                  <small>{item.sources.map((source) => source.reference).join(" · ")}</small>
                </li>
              ))}
            </ul>
          )}
          {lastRun.sources.length > 0 && (
            <details className="luftAiSources">
              <summary>Fuentes y evidencia ({lastRun.sources.length})</summary>
              {lastRun.sources.map((source) => <p key={`${source.kind}-${source.reference}`}><b>{source.kind}</b> · {source.reference}{source.note ? ` — ${source.note}` : ""}</p>)}
            </details>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="luftAiProposals">
          <h3>Esperando aprobación</h3>
          {pending.map((change) => (
            <article key={change.id}>
              <div><b>{change.path}</b><small>{change.agentId}</small></div>
              <p><del>{String(change.previousValue)}</del><span>→</span><ins>{String(change.nextValue)}</ins></p>
              <small>{change.reason}</small>
              <footer>
                <button type="button" onClick={() => decide(change.id, "rejected")}>Rechazar</button>
                <button type="button" className="primary" onClick={() => decide(change.id, "approved")} disabled={!canApprove || change.confidence.level === "blocked"}>Aprobar y aplicar</button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {state.audit.length > 0 && (
        <details className="luftAiAudit">
          <summary>Bitácora ({state.audit.length})</summary>
          {state.audit.slice(-5).reverse().map((entry) => (
            <p key={entry.id}><b>{entry.action}</b> · {entry.message}<small>{new Date(entry.createdAt).toLocaleString("es-MX")}</small></p>
          ))}
        </details>
      )}
    </section>
  );
}
