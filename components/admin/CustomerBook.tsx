"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { money } from "@/lib/money";
import { QUOTE_STATUSES, quoteStatusLabel, type QuoteStatus } from "@/lib/quoteStatus";
import type { QuoteEventRow, QuoteListRow } from "@/types/quote";

// El expediente de clientes del panel interno. Cada cotización que un cliente genera en /cotizar
// aparece aquí con sus datos, su documento y su etapa comercial.
//
// Está agrupado por cliente y no como una tabla plana de cotizaciones porque la pregunta real del
// negocio es "¿quién pidió qué?", y un cliente que vuelve tiene que reconocerse como el mismo:
// José Pérez con tres folios es una carpeta con tres cotizaciones, no tres desconocidos.
//
// Los importes SÍ se muestran aquí: es la contracara de habérselos quitado al cliente. Esta
// pantalla vive detrás de la contraseña interna (lib/internalGate.ts).

type Grouped = { customer: QuoteListRow["customer"]; quotes: QuoteListRow[] };

function groupByCustomer(rows: QuoteListRow[]): Grouped[] {
  const groups = new Map<string, Grouped>();
  for (const row of rows) {
    const group = groups.get(row.customer.id) ?? { customer: row.customer, quotes: [] };
    group.quotes.push(row);
    groups.set(row.customer.id, group);
  }
  // El orden lo fija la consulta (más reciente primero), así que el primer folio de cada cliente
  // ya es el más nuevo y los grupos salen en el orden en que llegaron sus últimas cotizaciones.
  return [...groups.values()];
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function CustomerBook() {
  const [rows, setRows] = useState<QuoteListRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openQuoteId, setOpenQuoteId] = useState("");
  const [events, setEvents] = useState<QuoteEventRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await fetch(`/api/quotes?${params.toString()}`);
      const payload = (await response.json()) as { quotes?: QuoteListRow[]; error?: string };
      if (!response.ok || !payload.quotes) throw new Error(payload.error ?? "No pudimos leer las cotizaciones.");
      setRows(payload.quotes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos leer las cotizaciones.");
    } finally {
      setLoading(false);
    }
  }, [query, status, from, to]);

  // La búsqueda espera a que dejes de escribir: cada tecla contra D1 sería una consulta por letra.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const groups = useMemo(() => groupByCustomer(rows), [rows]);
  const pipeline = rows.reduce((sum, row) => sum + row.total, 0);

  async function changeStatus(quoteId: string, next: QuoteStatus) {
    // Optimista: la etapa se mueve en pantalla y se corrige sola si el servidor falla.
    setRows((current) => current.map((row) => (row.id === quoteId ? { ...row, status: next } : row)));
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const payload = (await response.json()) as { events?: QuoteEventRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No pudimos guardar la etapa.");
      if (openQuoteId === quoteId && payload.events) setEvents(payload.events);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar la etapa.");
      void load();
    }
  }

  async function toggleHistory(quoteId: string) {
    if (openQuoteId === quoteId) {
      setOpenQuoteId("");
      return;
    }
    setOpenQuoteId(quoteId);
    setEvents([]);
    try {
      const response = await fetch(`/api/quotes/${quoteId}`);
      const payload = (await response.json()) as { events?: QuoteEventRow[] };
      setEvents(payload.events ?? []);
    } catch {
      setEvents([]);
    }
  }

  return (
    <div className="clientBook">
      <div className="clientBookFilters">
        <label>
          Buscar
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, teléfono, correo, folio o proyecto" />
        </label>
        <label>
          Etapa
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todas</option>
            {QUOTE_STATUSES.map((entry) => (
              <option key={entry} value={entry}>{quoteStatusLabel(entry)}</option>
            ))}
          </select>
        </label>
        <label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>

      <p className="clientBookSummary">
        {loading ? "Cargando…" : `${rows.length} ${rows.length === 1 ? "cotización" : "cotizaciones"} · ${groups.length} ${groups.length === 1 ? "cliente" : "clientes"} · ${money(pipeline)} en oportunidades`}
      </p>
      {error && <p className="clientBookError">{error}</p>}

      {!loading && rows.length === 0 && (
        <p className="clientBookEmpty">
          {query || status || from || to
            ? "Ningún cliente coincide con esos filtros."
            : "Todavía no hay cotizaciones enviadas desde el cotizador público."}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.customer.id} className="clientCard">
          <header>
            <div>
              <b>{group.customer.name}</b>
              <small>
                {[group.customer.company, group.customer.city, group.customer.postalCode].filter(Boolean).join(" · ") || "Sin ubicación"}
              </small>
            </div>
            <div className="clientCardContact">
              {group.customer.phone && (
                <a href={`https://wa.me/${group.customer.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                  {group.customer.phone}
                </a>
              )}
              {group.customer.email && <a href={`mailto:${group.customer.email}`}>{group.customer.email}</a>}
            </div>
          </header>
          {group.customer.address && <p className="clientCardAddress">{group.customer.address}</p>}

          <ul className="clientQuotes">
            {group.quotes.map((quote) => (
              <li key={quote.id}>
                <div className="clientQuoteRow">
                  <span className="clientQuoteFolio">
                    <b>{quote.folio}</b>
                    <small>{shortDate(quote.createdAt)} · {quote.projectName || "Sin nombre de proyecto"}</small>
                  </span>
                  <span className="clientQuoteFigures">
                    <small>{quote.itemCount} {quote.itemCount === 1 ? "diseño" : "diseños"} · {quote.pieceCount} {quote.pieceCount === 1 ? "pieza" : "piezas"}</small>
                    <b>{money(quote.total)}</b>
                  </span>
                  <select value={quote.status} onChange={(event) => void changeStatus(quote.id, event.target.value as QuoteStatus)}>
                    {QUOTE_STATUSES.map((entry) => (
                      <option key={entry} value={entry}>{quoteStatusLabel(entry)}</option>
                    ))}
                  </select>
                  <a className="clientQuoteDoc" href={`/cotizacion/${quote.token}`} target="_blank" rel="noopener noreferrer">PDF</a>
                  <button onClick={() => void toggleHistory(quote.id)}>{openQuoteId === quote.id ? "Ocultar" : "Historial"}</button>
                </div>
                {quote.notes && <p className="clientQuoteNotes">“{quote.notes}”</p>}
                {openQuoteId === quote.id && (
                  <ol className="clientQuoteHistory">
                    {events.length === 0 && <li>Sin movimientos registrados.</li>}
                    {events.map((event) => (
                      <li key={event.id}>
                        <b>{quoteStatusLabel(event.status)}</b>
                        <small>{shortDate(event.createdAt)}{event.note ? ` · ${event.note}` : ""}</small>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
