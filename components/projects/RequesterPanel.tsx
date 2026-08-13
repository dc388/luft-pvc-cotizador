"use client";

import { useMemo, useState } from "react";
import { PROJECT_STATUSES, projectStatusLabel } from "@/lib/projectStatus";
import { emptyAddress, isAddressEmpty, requesterIssues } from "@/lib/requester";
import type { Address, ProjectStatus, Requester } from "@/types/project";

/**
 * La ficha del solicitante del proyecto abierto.
 *
 * Se edita en un borrador local y se guarda al pulsar Guardar, no letra por letra. Es lo contrario de
 * lo que hace el resto del editor (que autoguarda), y es a propósito: la ficha se valida entera
 * -- correo, teléfonos, códigos postales -- y guardar a cada tecla significaría rechazar un correo a
 * medio escribir en cada pulsación. El botón se habilita solo si hay cambios, y dice cuáles quedan
 * sin guardar.
 *
 * Las direcciones de instalación y facturación son opcionales en un sentido preciso: si están
 * apagadas se guardan como `null`, que significa "la misma que la principal" y no "vacía". Esa
 * diferencia se conserva al exportar y al importar.
 *
 * El borrador se inicializa UNA vez y no se sincroniza con las props mediante un efecto: quien la usa
 * la monta con `key={projectId}` (ver app/Workspace.tsx), así que cambiar de proyecto la remonta y el
 * borrador nace del proyecto nuevo. Es la forma que React recomienda para "reiniciar el estado cuando
 * cambia una prop", y evita el render extra -- y el riesgo de pisar lo que se está escribiendo -- que
 * tenía el efecto de sincronización.
 */

const CHANNELS = [
  "Recomendación",
  "Redes sociales",
  "Sitio web",
  "Cotizador público",
  "Visita a showroom",
  "Llamada telefónica",
  "Cliente recurrente",
];

function dateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-MX", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type Props = {
  requester: Requester;
  status: ProjectStatus;
  currency: string;
  pricingListId: string;
  estimatedDate: string;
  notes: string;
  folio: string;
  saving: boolean;
  error: string;
  readOnly: boolean;
  onSave: (patch: {
    requester: Requester;
    status: ProjectStatus;
    currency: string;
    pricingListId: string;
    estimatedDate: string;
    notes: string;
  }) => void;
};

export function RequesterPanel({
  requester,
  status,
  currency,
  pricingListId,
  estimatedDate,
  notes,
  folio,
  saving,
  error,
  readOnly,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<Requester>(requester);
  const [draftStatus, setDraftStatus] = useState<ProjectStatus>(status);
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [draftPricing, setDraftPricing] = useState(pricingListId);
  const [draftEstimated, setDraftEstimated] = useState(estimatedDate);
  const [draftNotes, setDraftNotes] = useState(notes);
  const [showIssues, setShowIssues] = useState(false);

  const issues = useMemo(() => requesterIssues(draft), [draft]);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(requester) ||
    draftStatus !== status ||
    draftCurrency !== currency ||
    draftPricing !== pricingListId ||
    draftEstimated !== estimatedDate ||
    draftNotes !== notes;

  function set<K extends keyof Requester>(key: K, value: Requester[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setAddress(key: "address" | "installationAddress" | "billingAddress", patch: Partial<Address>) {
    setDraft((current) => {
      const base = current[key] ?? emptyAddress();
      return { ...current, [key]: { ...base, ...patch } };
    });
  }

  function toggleAlternate(key: "installationAddress" | "billingAddress", on: boolean) {
    setDraft((current) => ({ ...current, [key]: on ? (current[key] ?? { ...current.address }) : null }));
  }

  function save() {
    setShowIssues(true);
    if (issues.length > 0) return;
    onSave({
      requester: draft,
      status: draftStatus,
      currency: draftCurrency,
      pricingListId: draftPricing,
      estimatedDate: draftEstimated,
      notes: draftNotes,
    });
  }

  const issueFor = (field: string) => (showIssues ? issues.find((issue) => issue.field === field)?.message : undefined);

  return (
    <div className="requesterPanel">
      {/* Las fechas salen de las props y no del borrador: son cuándo se guardó de verdad, no cuándo
          se está escribiendo. */}
      <div className="requesterMeta">
        <span>Folio<b>{folio || "Sin folio"}</b></span>
        <span>Registrado<b>{dateLabel(requester.createdAt)}</b></span>
        <span>Última actualización<b>{dateLabel(requester.updatedAt)}</b></span>
      </div>

      <div className="inputGrid two">
        <label>
          Nombre completo
          <input value={draft.fullName} onChange={(event) => set("fullName", event.target.value)} disabled={readOnly} />
        </label>
        <label>
          Empresa o razón social
          <input value={draft.company} onChange={(event) => set("company", event.target.value)} disabled={readOnly} />
        </label>
      </div>

      <div className="inputGrid two">
        <label className={issueFor("phone") ? "hasIssue" : ""}>
          Teléfono principal
          <input type="tel" value={draft.phone} onChange={(event) => set("phone", event.target.value)} disabled={readOnly} />
          {issueFor("phone") && <small className="fieldIssue">{issueFor("phone")}</small>}
        </label>
        <label className={issueFor("alternatePhone") ? "hasIssue" : ""}>
          Teléfono alternativo
          <input
            type="tel"
            value={draft.alternatePhone}
            onChange={(event) => set("alternatePhone", event.target.value)}
            disabled={readOnly}
          />
          {issueFor("alternatePhone") && <small className="fieldIssue">{issueFor("alternatePhone")}</small>}
        </label>
      </div>

      <div className="inputGrid two">
        <label className={issueFor("email") ? "hasIssue" : ""}>
          Correo electrónico
          <input type="email" value={draft.email} onChange={(event) => set("email", event.target.value)} disabled={readOnly} />
          {issueFor("email") && <small className="fieldIssue">{issueFor("email")}</small>}
        </label>
        <label>
          Persona de contacto
          <input value={draft.contactPerson} onChange={(event) => set("contactPerson", event.target.value)} disabled={readOnly} />
        </label>
      </div>

      <div className="inputGrid two">
        <label>
          RFC o identificador fiscal
          <input value={draft.taxId} onChange={(event) => set("taxId", event.target.value)} disabled={readOnly} placeholder="Opcional" />
        </label>
        <label>
          Canal de adquisición
          <input
            list="requesterChannels"
            value={draft.acquisitionChannel}
            onChange={(event) => set("acquisitionChannel", event.target.value)}
            disabled={readOnly}
          />
          <datalist id="requesterChannels">
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel} />
            ))}
          </datalist>
        </label>
      </div>

      <AddressFields
        legend="Dirección"
        address={draft.address}
        readOnly={readOnly}
        issue={issueFor("address")}
        onChange={(patch) => setAddress("address", patch)}
      />

      <label className="requesterToggle">
        <input
          type="checkbox"
          checked={draft.installationAddress !== null}
          onChange={(event) => toggleAlternate("installationAddress", event.target.checked)}
          disabled={readOnly}
        />
        La instalación es en otra dirección
      </label>
      {draft.installationAddress !== null && (
        <AddressFields
          legend="Dirección de instalación"
          address={draft.installationAddress}
          readOnly={readOnly}
          onChange={(patch) => setAddress("installationAddress", patch)}
        />
      )}

      <label className="requesterToggle">
        <input
          type="checkbox"
          checked={draft.billingAddress !== null}
          onChange={(event) => toggleAlternate("billingAddress", event.target.checked)}
          disabled={readOnly}
        />
        Facturar a otra dirección
      </label>
      {draft.billingAddress !== null && (
        <AddressFields
          legend="Dirección de facturación"
          address={draft.billingAddress}
          readOnly={readOnly}
          onChange={(patch) => setAddress("billingAddress", patch)}
        />
      )}

      <label>
        Notas del solicitante
        <textarea rows={3} value={draft.notes} onChange={(event) => set("notes", event.target.value)} disabled={readOnly} />
      </label>

      <div className="inputGrid two">
        <label>
          Etapa del proyecto
          <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as ProjectStatus)} disabled={readOnly}>
            {PROJECT_STATUSES.map((option) => (
              <option key={option} value={option}>{projectStatusLabel(option)}</option>
            ))}
          </select>
        </label>
        <label>
          Moneda
          <select value={draftCurrency} onChange={(event) => setDraftCurrency(event.target.value)} disabled={readOnly}>
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
      </div>

      <div className="inputGrid two">
        <label>
          Lista de precios
          <input value={draftPricing} onChange={(event) => setDraftPricing(event.target.value)} disabled={readOnly} />
        </label>
        <label>
          Fecha estimada
          <input type="date" value={draftEstimated} onChange={(event) => setDraftEstimated(event.target.value)} disabled={readOnly} />
        </label>
      </div>

      <label>
        Notas del proyecto
        <textarea rows={3} value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} disabled={readOnly} />
      </label>

      {showIssues && issues.length > 0 && (
        <div className="requesterIssues" role="alert">
          {issues.map((issue) => (
            <p key={`${issue.field}-${issue.message}`}>⚠ {issue.message}</p>
          ))}
        </div>
      )}
      {error && <p className="requesterIssues" role="alert">⚠ {error}</p>}

      <button type="button" className="fullButton" onClick={save} disabled={readOnly || saving || !dirty}>
        {saving ? "Guardando ficha…" : dirty ? "Guardar ficha del solicitante" : "Ficha guardada"}
      </button>
      {dirty && !saving && <p className="requesterDirty">Hay cambios sin guardar en esta ficha.</p>}
    </div>
  );
}

function AddressFields({
  legend,
  address,
  readOnly,
  issue,
  onChange,
}: {
  legend: string;
  address: Address;
  readOnly: boolean;
  issue?: string;
  onChange: (patch: Partial<Address>) => void;
}) {
  return (
    <fieldset className="requesterAddress">
      <legend>
        {legend}
        {isAddressEmpty(address) && <span className="requesterAddressEmpty"> · sin capturar</span>}
      </legend>
      <label>
        Calle y número
        <input value={address.street} onChange={(event) => onChange({ street: event.target.value })} disabled={readOnly} />
      </label>
      <div className="inputGrid two">
        <label>
          Ciudad
          <input value={address.city} onChange={(event) => onChange({ city: event.target.value })} disabled={readOnly} />
        </label>
        <label>
          Estado
          <input value={address.state} onChange={(event) => onChange({ state: event.target.value })} disabled={readOnly} />
        </label>
      </div>
      <div className="inputGrid two">
        <label className={issue ? "hasIssue" : ""}>
          Código postal
          <input
            inputMode="numeric"
            maxLength={5}
            value={address.postalCode}
            onChange={(event) => onChange({ postalCode: event.target.value })}
            disabled={readOnly}
          />
          {issue && <small className="fieldIssue">{issue}</small>}
        </label>
        <label>
          País
          <input value={address.country} onChange={(event) => onChange({ country: event.target.value })} disabled={readOnly} />
        </label>
      </div>
    </fieldset>
  );
}
