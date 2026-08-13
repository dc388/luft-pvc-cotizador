"use client";

import { useCallback, useEffect, useState } from "react";
import type { MacoHardwareRow, MacoRevision, MacoSearchField } from "@/types/maco";

// Consulta del catálogo de herrajes MACO para sistemas Aluplast, en el área interna.
//
// MACO es el FABRICANTE DE HERRAJES; Aluplast es la marca de los perfiles. La pantalla lo dice
// explícitamente porque la confusión es fácil y cara: si alguien lee esta lista como si fuera de
// perfiles, termina cotizando una manilla como si fuera un metro de marco.
//
// Los precios llegan por fetch a /api/maco-hardware (protegida por la contraseña interna, ver
// lib/internalGate.ts) y NUNCA vienen incrustados en el HTML: este componente arranca vacío y
// pide solo la página que se está viendo. Es lo que evita que una lista de proveedor acabe en el
// documento que se sirve a un cliente.

type Payload = {
  title?: string;
  revisions?: MacoRevision[];
  rows?: MacoHardwareRow[];
  total?: number;
  limit?: number;
  offset?: number;
  error?: string;
};

const FIELDS: { value: MacoSearchField; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "sku", label: "Código (SKU)" },
  { value: "clave", label: "Clave alterna" },
  { value: "descripcion", label: "Descripción" },
];

export function HerrajesMaco() {
  const [query, setQuery] = useState("");
  const [field, setField] = useState<MacoSearchField>("todo");
  const [revision, setRevision] = useState("");
  const [revisions, setRevisions] = useState<MacoRevision[]>([]);
  const [rows, setRows] = useState<MacoHardwareRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (field !== "todo") params.set("campo", field);
      if (revision) params.set("revision", revision);
      params.set("desde", String(offset));
      const response = await fetch(`/api/maco-hardware?${params.toString()}`);
      const payload = (await response.json()) as Payload;
      if (!response.ok) throw new Error(payload.error ?? "No pudimos leer el catálogo de herrajes.");
      setRevisions(payload.revisions ?? []);
      setRows(payload.rows ?? []);
      setTotal(payload.total ?? 0);
      setLimit(payload.limit ?? 25);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos leer el catálogo de herrajes.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, field, revision, offset]);

  // Igual que en el expediente de clientes: se espera a que dejes de escribir para no lanzar una
  // consulta por tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Cambiar de filtro vuelve a la primera página: quedarse en la página 8 de un resultado que
  // ahora tiene 3 renglones muestra una tabla vacía sin explicación. Se hace en el propio
  // manejador y no en un efecto: un efecto que llama setState provoca un render en cascada, y
  // además dispararía una búsqueda con el desplazamiento viejo antes de corregirlo.
  const changeQuery = (next: string) => {
    setQuery(next);
    setOffset(0);
  };
  const changeField = (next: MacoSearchField) => {
    setField(next);
    setOffset(0);
  };
  const changeRevision = (next: string) => {
    setRevision(next);
    setOffset(0);
  };

  const current = revisions.find((entry) => entry.revision === revision) ?? revisions[0];
  const page = Math.floor(offset / Math.max(1, limit)) + 1;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return (
    <div className="macoCatalog">
      <p className="macoCatalogLead">
        <b>Herrajes MACO para sistemas Aluplast.</b> MACO es el fabricante de los herrajes,
        mecanismos y accesorios; Aluplast es la marca de los perfiles con la que son compatibles.
        Esta lista no contiene perfiles ni precios de marco u hoja.
      </p>

      {current && (
        <p className={current.active ? "macoRevision macoRevisionActive" : "macoRevision"}>
          {current.label}
          <small>
            {current.itemCount} artículos · archivo {current.fileName} · SHA-256 {current.fileHashShort}…
            {current.active ? "" : " · no se usa para cotización automática"}
          </small>
        </p>
      )}

      <div className="macoCatalogFilters">
        <label>
          Buscar
          <input
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Código, clave alterna o descripción"
          />
        </label>
        <label>
          Campo
          <select value={field} onChange={(event) => changeField(event.target.value as MacoSearchField)}>
            {FIELDS.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </label>
        <label>
          Revisión
          <select value={revision} onChange={(event) => changeRevision(event.target.value)}>
            {revisions.map((entry) => (
              <option key={entry.revision} value={entry.revision}>
                {entry.revision}{entry.active ? " (vigente)" : " (histórica)"}
              </option>
            ))}
            {revisions.length === 0 && <option value="">Sin revisiones importadas</option>}
          </select>
        </label>
      </div>

      <p className="macoCatalogSummary">
        {loading
          ? "Buscando…"
          : `${total} ${total === 1 ? "artículo" : "artículos"}${total > 0 ? ` · página ${page} de ${pages}` : ""}`}
      </p>
      {error && <p className="macoCatalogError">{error}</p>}

      {!loading && rows.length === 0 && !error && (
        <p className="macoCatalogEmpty">
          {revisions.length === 0
            ? 'Todavía no se ha importado ninguna revisión de la lista MACO. Ejecuta `npm run maco:import -- --file="<ruta al Excel del proveedor>"`.'
            : "Ningún herraje coincide con esa búsqueda."}
        </p>
      )}

      {rows.length > 0 && (
        <div className="macoCatalogTableWrap">
          <table className="macoCatalogTable">
            <thead>
              <tr>
                <th>Código</th>
                <th>Clave alterna</th>
                <th>Descripción</th>
                <th>Unidad</th>
                <th>Pres.</th>
                <th>Cant/pres.</th>
                <th>Precio un.</th>
                <th>Procedencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sku}>
                  <td className="macoSku">{row.sku}</td>
                  <td>{row.altKey || "—"}</td>
                  <td className="macoDescription">{row.description}</td>
                  <td>{row.unit || "—"}</td>
                  <td>{row.presentation || "—"}</td>
                  <td>{row.qtyPerPresentation || "—"}</td>
                  <td className="macoPrice">
                    <b>{row.unitPrice}</b> <small>{row.currency}</small>
                  </td>
                  <td className="macoProvenance">
                    <small>
                      {row.supplier} → {row.brand} · rev. {row.revision} · {row.effectiveDate} · fila {row.sourceRow}
                      <br />
                      {row.terms}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > limit && (
        <div className="macoCatalogPager">
          <button disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>
            ← Anteriores
          </button>
          <span>{page} / {pages}</span>
          <button disabled={offset + limit >= total || loading} onClick={() => setOffset(offset + limit)}>
            Siguientes →
          </button>
        </div>
      )}
    </div>
  );
}
