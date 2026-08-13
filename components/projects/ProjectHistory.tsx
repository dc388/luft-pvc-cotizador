"use client";

import { useState } from "react";
import { money } from "@/lib/money";
import type { ProjectVersionRow } from "@/types/project";

/**
 * Puntos de restauración y cierre de obra del proyecto abierto.
 *
 * Los dos viven juntos porque son las dos caras de "qué pasó con este proyecto": uno guarda estados
 * anteriores del trabajo, el otro registra cómo terminó en la realidad.
 *
 * El cierre de obra es la única fuente posible de "costo real frente a estimado" y "cotizado frente a
 * fabricado". No se puede deducir de la configuración: se captura al terminar la obra. Hasta que
 * alguien lo capture, la plataforma dice que no lo sabe.
 */

const REASON_LABEL: Record<ProjectVersionRow["reason"], string> = {
  manual: "Creado a mano",
  "antes-de-importar": "Automático · antes de importar sobre este proyecto",
  "antes-de-restaurar": "Automático · antes de restaurar otro punto",
};

function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export type OutcomeDraft = {
  actualCost: number;
  actualRevenue: number;
  piecesBuilt: number;
  notes: string;
};

export type ProjectOutcomeView = OutcomeDraft & {
  quotedTotal: number;
  quotedPieces: number;
  closedAt: string;
  updatedAt: string;
};

type Props = {
  versions: ProjectVersionRow[];
  outcome: ProjectOutcomeView | null;
  /** Totales cotizados ahora, para poder pre-llenar el cierre con algo verificable. */
  quotedTotal: number;
  quotedPieces: number;
  busy: boolean;
  readOnly: boolean;
  error: string;
  onCreateVersion: (label: string) => void;
  onRestoreVersion: (version: ProjectVersionRow) => void;
  onSaveOutcome: (draft: OutcomeDraft) => void;
  onClearOutcome: () => void;
};

export function ProjectHistory({
  versions,
  outcome,
  quotedTotal,
  quotedPieces,
  busy,
  readOnly,
  error,
  onCreateVersion,
  onRestoreVersion,
  onSaveOutcome,
  onClearOutcome,
}: Props) {
  const [label, setLabel] = useState("");
  const [showOutcome, setShowOutcome] = useState(false);
  // El borrador arranca del cierre existente si lo hay; si no, de lo cotizado, que es la única cifra
  // ya conocida y el punto de partida natural para corregirla con lo que pasó de verdad.
  const [draft, setDraft] = useState<OutcomeDraft>(() => ({
    actualCost: outcome?.actualCost ?? 0,
    actualRevenue: outcome?.actualRevenue ?? quotedTotal,
    piecesBuilt: outcome?.piecesBuilt ?? quotedPieces,
    notes: outcome?.notes ?? "",
  }));

  const costDeviation =
    outcome && outcome.quotedTotal > 0 && outcome.actualCost > 0
      ? ((outcome.actualCost - outcome.quotedTotal) / outcome.quotedTotal) * 100
      : null;
  const realMargin =
    outcome && outcome.actualRevenue > 0 ? ((outcome.actualRevenue - outcome.actualCost) / outcome.actualRevenue) * 100 : null;
  const piecesDeviation =
    outcome && outcome.quotedPieces > 0 ? ((outcome.piecesBuilt - outcome.quotedPieces) / outcome.quotedPieces) * 100 : null;

  return (
    <div className="projectHistory">
      <div className="historyBlock">
        <h3>Puntos de restauración</h3>
        <p className="historyHint">
          Cada punto guarda el proyecto completo: sus datos, su solicitante y todos sus componentes. Se
          crea uno solo, además, antes de importar sobre este proyecto o de restaurar otro punto.
        </p>
        {!readOnly && (
          <div className="historyCreate">
            <label>
              <span className="visuallyHidden">Nombre del punto</span>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Antes de cambiar el sistema, versión para el cliente…"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onCreateVersion(label);
                setLabel("");
              }}
            >
              Crear punto
            </button>
          </div>
        )}
        {versions.length === 0 ? (
          <p className="historyEmpty">Todavía no hay puntos de restauración de este proyecto.</p>
        ) : (
          <ul className="historyList">
            {versions.map((version) => (
              <li key={version.id}>
                <span>
                  <b>{version.label || REASON_LABEL[version.reason]}</b>
                  <small>
                    {stamp(version.createdAt)} · {version.componentCount}{" "}
                    {version.componentCount === 1 ? "componente" : "componentes"}
                    {version.total > 0 ? ` · ${money(version.total)}` : ""}
                    {version.label ? ` · ${REASON_LABEL[version.reason]}` : ""}
                  </small>
                </span>
                <button type="button" disabled={busy || readOnly} onClick={() => onRestoreVersion(version)}>
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="historyBlock">
        <h3>Cierre de obra</h3>
        <p className="historyHint">
          Lo que costó y se cobró de verdad. Es lo que permite comparar el costo real con el estimado y
          lo fabricado con lo cotizado; sin capturarlo, esas cifras no existen y la plataforma no las
          inventa.
        </p>

        {outcome ? (
          <div className="outcomeSummary">
            <span>
              Cotizado<b>{money(outcome.quotedTotal)}</b>
            </span>
            <span>
              Costo real<b>{money(outcome.actualCost)}</b>
            </span>
            <span>
              Cobrado<b>{money(outcome.actualRevenue)}</b>
            </span>
            <span>
              Desvío de costo
              <b className={costDeviation !== null && costDeviation > 0 ? "isOver" : undefined}>
                {costDeviation === null ? "—" : `${costDeviation > 0 ? "+" : ""}${costDeviation.toFixed(1)}%`}
              </b>
            </span>
            <span>
              Margen real<b>{realMargin === null ? "—" : `${realMargin.toFixed(1)}%`}</b>
            </span>
            <span>
              Piezas
              <b>
                {outcome.piecesBuilt} de {outcome.quotedPieces}
                {piecesDeviation !== null && piecesDeviation !== 0 ? ` (${piecesDeviation > 0 ? "+" : ""}${piecesDeviation.toFixed(1)}%)` : ""}
              </b>
            </span>
            <span>
              Cerrada<b>{stamp(outcome.closedAt)}</b>
            </span>
          </div>
        ) : (
          <p className="historyEmpty">Esta obra no se ha cerrado todavía.</p>
        )}
        {outcome?.notes && <p className="outcomeNotes">“{outcome.notes}”</p>}

        {!readOnly && (
          <>
            <button type="button" className="historyToggle" onClick={() => setShowOutcome((open) => !open)}>
              {showOutcome ? "Ocultar captura" : outcome ? "Corregir el cierre" : "Registrar el cierre"}
            </button>
            {showOutcome && (
              <div className="outcomeForm">
                <div className="inputGrid two">
                  <label>
                    Costo real total
                    <input
                      type="number"
                      min={0}
                      value={draft.actualCost || ""}
                      onChange={(event) => setDraft({ ...draft, actualCost: Number(event.target.value) })}
                      placeholder="Materiales, mano de obra, instalación"
                    />
                  </label>
                  <label>
                    Cobrado al cliente
                    <input
                      type="number"
                      min={0}
                      value={draft.actualRevenue || ""}
                      onChange={(event) => setDraft({ ...draft, actualRevenue: Number(event.target.value) })}
                    />
                  </label>
                </div>
                <label>
                  Piezas fabricadas
                  <input
                    type="number"
                    min={0}
                    value={draft.piecesBuilt || ""}
                    onChange={(event) => setDraft({ ...draft, piecesBuilt: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Notas del cierre
                  <textarea
                    rows={3}
                    value={draft.notes}
                    onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                    placeholder="Qué se desvió y por qué: refuerzos extra, un vidrio repuesto, medición corregida en obra…"
                  />
                </label>
                <p className="historyHint">
                  De esto, a las estadísticas de mejora solo van las desviaciones en porcentaje. Los
                  importes y las notas se quedan en el proyecto.
                </p>
                <div className="outcomeActions">
                  <button
                    type="button"
                    className="explorerPrimary"
                    disabled={busy || draft.actualCost <= 0}
                    title={draft.actualCost <= 0 ? "Hace falta el costo real para poder comparar" : undefined}
                    onClick={() => onSaveOutcome(draft)}
                  >
                    Guardar cierre
                  </button>
                  {outcome && (
                    <button type="button" className="explorerDanger" disabled={busy} onClick={onClearOutcome}>
                      Borrar el cierre
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="requesterIssues" role="alert">⚠ {error}</p>}
    </div>
  );
}
