"use client";

import { useState } from "react";
import type { LearningStats, QuoteTemplate, Recommendation } from "@/lib/learningRules";

/**
 * Recomendaciones para cotizar, y el control de lo que las alimenta.
 *
 * Tres cosas que esta pantalla hace y que son el punto de §9:
 *
 *   - Cada recomendación muestra EN QUÉ SE APOYA y con cuántos datos. Una basada en tres componentes
 *     lo dice y se marca como poco confiable; no se disfraza de certeza ni se esconde.
 *   - Nada se aplica solo. Las que proponen un valor traen un botón; las que solo avisan no lo traen
 *     porque no hay nada que aplicar. Descartar es siempre posible.
 *   - El interruptor de recopilación y el borrado del historial están aquí mismo, junto a lo que
 *     producen, y no escondidos en otra pantalla.
 *
 * Lo que NO hay aquí, y no se simula: comparación de costo real contra estimado, y diferencias entre
 * lo cotizado y lo fabricado. Nadie captura hoy el resultado de fabricación en la plataforma, así que
 * no hay dato con el que calcularlo.
 */

const CONFIDENCE_LABEL = {
  alta: "Dato sólido",
  media: "Indicio",
  baja: "Pocos datos",
} as const;

type Props = {
  enabled: boolean;
  loading: boolean;
  stats: LearningStats | null;
  templates: QuoteTemplate[];
  recommendations: Recommendation[];
  onToggle: (enabled: boolean) => void;
  onApply: (recommendation: Recommendation) => void;
  onUseTemplate: (template: QuoteTemplate) => void;
  onClearHistory: () => void;
};

export function QuoteInsights({
  enabled,
  loading,
  stats,
  templates,
  recommendations,
  onToggle,
  onApply,
  onUseTemplate,
  onClearHistory,
}: Props) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const visible = recommendations.filter((recommendation) => !dismissed.includes(recommendation.id));

  return (
    <div className="quoteInsights">
      <label className="insightsToggle">
        <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} />
        <span>
          <b>Aprender de mis cotizaciones</b>
          <small>
            Guarda tipologías, sistemas, medidas, vidrios, herrajes, márgenes e importes de lo que
            cotizas, para poder sugerir y avisar. No guarda ningún dato de tus clientes: ni nombres, ni
            teléfonos, ni correos, ni direcciones, ni a qué proyecto pertenece cada dato.
          </small>
        </span>
      </label>

      {!enabled ? (
        <p className="insightsOff">
          El registro está apagado. Sin datos la plataforma no puede sugerir nada, y no se guarda nada
          nuevo. Las recomendaciones que solo revisan el proyecto abierto (campos vacíos, componentes
          repetidos) siguen funcionando.
        </p>
      ) : loading ? (
        <p className="notice">Leyendo el historial…</p>
      ) : null}

      {visible.length === 0 ? (
        <p className="insightsEmpty">
          {enabled && stats && stats.sampleSize === 0
            ? "Todavía no hay historial suficiente. Conforme cotices, aquí aparecerán sugerencias con el dato que las respalda."
            : "Nada que señalar en este componente."}
        </p>
      ) : (
        <ul className="insightsList">
          {visible.map((recommendation) => (
            <li key={recommendation.id} className={`insightCard kind-${recommendation.kind} confidence-${recommendation.confidence}`}>
              <header>
                <b>{recommendation.title}</b>
                <span className={`insightConfidence confidence-${recommendation.confidence}`} title={`Confianza: ${recommendation.confidence}`}>
                  {CONFIDENCE_LABEL[recommendation.confidence]}
                </span>
              </header>
              <p>{recommendation.detail}</p>
              <p className="insightBasis">
                <i aria-hidden="true">▤</i> {recommendation.basis}
                {recommendation.confidence === "baja" && recommendation.sampleSize > 0 && (
                  <em> Con tan pocos casos, esta señal puede no ser confiable.</em>
                )}
              </p>
              <div className="insightActions">
                {recommendation.suggestion && (
                  <button type="button" onClick={() => onApply(recommendation)}>
                    Aplicar
                  </button>
                )}
                <button
                  type="button"
                  className="insightDismiss"
                  onClick={() => setDismissed((current) => [...current, recommendation.id])}
                >
                  Descartar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {enabled && templates.length > 0 && (
        <div className="insightsTemplates">
          <h3>Configuraciones que más repites</h3>
          <p className="insightBasis">Salen de tus propios proyectos anteriores; la medida es la mediana de cada grupo.</p>
          <ul>
            {templates.map((template) => (
              <li key={`${template.typology}-${template.widthMm}-${template.heightMm}`}>
                <span>
                  <b>{template.typology}</b>
                  <small>
                    {template.widthMm}×{template.heightMm} mm
                    {template.systemName ? ` · ${template.systemName}` : ""}
                    {template.glassName ? ` · ${template.glassName}` : ""}
                    {` · usada ${template.timesUsed} ${template.timesUsed === 1 ? "vez" : "veces"}`}
                  </small>
                </span>
                <button type="button" onClick={() => onUseTemplate(template)} title="Aplica las medidas al componente abierto">
                  Usar medidas
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {enabled && stats && stats.sampleSize > 0 && (
        <details className="insightsStats">
          <summary>Qué sabe la plataforma ({stats.sampleSize} componentes registrados)</summary>
          <dl>
            <dt>Tipología más usada</dt>
            <dd>{stats.typologies[0] ? `${stats.typologies[0].value} (${stats.typologies[0].count})` : "—"}</dd>
            <dt>Sistema más usado</dt>
            <dd>{stats.systems[0] ? `${stats.systems[0].value} (${stats.systems[0].count})` : "—"}</dd>
            <dt>Vidrio más usado</dt>
            <dd>{stats.glasses[0] ? `${stats.glasses[0].value} (${stats.glasses[0].count})` : "—"}</dd>
            <dt>Herraje más usado</dt>
            <dd>{stats.hardware[0] ? `${stats.hardware[0].value} (${stats.hardware[0].count})` : "—"}</dd>
            <dt>Medida habitual</dt>
            <dd>
              {stats.widthMm.count > 0
                ? `${Math.round(stats.widthMm.median)} × ${Math.round(stats.heightMm.median)} mm (mediana)`
                : "—"}
            </dd>
            <dt>Margen habitual</dt>
            <dd>{stats.marginPct.count > 0 ? `${Math.round(stats.marginPct.median)}%` : "—"}</dd>
            <dt>Descuento habitual</dt>
            <dd>{stats.discountPct.count > 0 ? `${Math.round(stats.discountPct.median)}%` : "—"}</dd>
            <dt>Tiempo por componente</dt>
            <dd>
              {stats.editSeconds.count > 0
                ? `${Math.round(stats.editSeconds.median / 60)} min (mediana de ${stats.editSeconds.count})`
                : "—"}
            </dd>
            <dt>Componentes duplicados</dt>
            <dd>{stats.duplicates}</dd>
            <dt>Cotizaciones resueltas</dt>
            <dd>
              {stats.outcomes.accepted + stats.outcomes.rejected > 0
                ? `${stats.outcomes.accepted} aceptadas · ${stats.outcomes.rejected} rechazadas`
                : "Aún ninguna cerrada"}
            </dd>
            <dt>Motivo de rechazo más frecuente</dt>
            <dd>{stats.outcomes.reasons[0] ? `${stats.outcomes.reasons[0].value} (${stats.outcomes.reasons[0].count})` : "—"}</dd>
          </dl>
          <p className="insightBasis">
            Pendiente y no simulado: comparar costo real contra costo estimado y medir diferencias entre
            lo cotizado y lo fabricado. Hoy nadie captura el resultado de fabricación en la plataforma,
            así que no hay dato con el que calcularlo.
          </p>
        </details>
      )}

      <div className="insightsDanger">
        {confirmingClear ? (
          <>
            <p>
              Se borrarán {stats?.totalEvents ?? 0} registro(s) estadístico(s). Tus proyectos, sus
              componentes y sus clientes no se tocan.
            </p>
            <button
              type="button"
              className="explorerDanger"
              onClick={() => {
                onClearHistory();
                setConfirmingClear(false);
              }}
            >
              Sí, borrar el historial
            </button>
            <button type="button" onClick={() => setConfirmingClear(false)}>Cancelar</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmingClear(true)}>Borrar el historial de mejora</button>
        )}
      </div>
    </div>
  );
}
