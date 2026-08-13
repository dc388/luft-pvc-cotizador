"use client";

import { useEffect, useRef, useState } from "react";
import { emptyRequester, requesterIssues } from "@/lib/requester";
import type { ProjectDraft } from "@/types/project";

/**
 * Alta de proyecto.
 *
 * Pide solo lo indispensable y deja terminar el resto después: el único campo obligatorio es el
 * nombre del proyecto. Nada de datos fiscales ni direcciones alternas para poder empezar (§4 del
 * pedido) -- eso vive en la ficha del solicitante, que se completa con el proyecto ya abierto.
 *
 * Lo capturado NO se pierde si falla la red: el formulario no se cierra al fallar, conserva todo lo
 * escrito y muestra el error para reintentar. Además se guarda una copia en `localStorage` en cada
 * cambio, así que una recarga accidental a media captura tampoco se lleva el trabajo.
 *
 * Es un <dialog> nativo y no un div flotante porque así el foco queda atrapado dentro, Escape cierra
 * y el resto de la página queda inerte, sin escribir nada de eso a mano.
 */

const DRAFT_KEY = "luft-pvc-cotizador:new-project-draft:v1";

const CHANNELS = [
  "Recomendación",
  "Redes sociales",
  "Sitio web",
  "Cotizador público",
  "Visita a showroom",
  "Llamada telefónica",
  "Cliente recurrente",
];

type FormState = {
  name: string;
  fullName: string;
  company: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  acquisitionChannel: string;
  notes: string;
  currency: string;
  pricingListId: string;
  estimatedDate: string;
};

const EMPTY: FormState = {
  name: "",
  fullName: "",
  company: "",
  phone: "",
  email: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  acquisitionChannel: "",
  notes: "",
  currency: "MXN",
  pricingListId: "",
  estimatedDate: "",
};

function readDraft(): FormState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<FormState>;
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Sin almacenamiento no hay copia que borrar.
  }
}

type Props = {
  open: boolean;
  busy: boolean;
  /** Error de la última creación fallida. Mientras haya error el diálogo no se cierra. */
  error: string;
  /** Se incrementa cuando un proyecto se creó de verdad. Es la señal para descartar lo capturado:
   *  mientras no cambie, el formulario conserva todo -- incluso si se cerró y se volvió a abrir. */
  resetToken: number;
  onCancel: () => void;
  onCreate: (draft: ProjectDraft) => void;
};

export function NewProjectDialog({ open, busy, error, resetToken, onCancel, onCreate }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setForm(readDraft());
      setIssues([]);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      // Igual que arriba: se pierde la red de seguridad, no lo escrito en pantalla.
    }
  }, [form, open]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    const found: string[] = [];
    if (!form.name.trim()) found.push("Escribe un nombre para el proyecto.");

    // Se validan teléfono y correo con las MISMAS reglas que el resto de la plataforma, y solo si se
    // escribieron: un proyecto puede empezar con nombre y nada más.
    const candidate = {
      ...emptyRequester(new Date().toISOString()),
      fullName: form.fullName.trim(),
      company: form.company.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      acquisitionChannel: form.acquisitionChannel.trim(),
      address: {
        street: form.street.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: "",
      },
    };
    found.push(...requesterIssues(candidate).map((issue) => issue.message));

    setIssues(found);
    if (found.length > 0) return;

    onCreate({
      name: form.name.trim(),
      requester: {
        fullName: candidate.fullName,
        company: candidate.company,
        phone: candidate.phone,
        email: candidate.email,
        acquisitionChannel: candidate.acquisitionChannel,
        address: candidate.address,
      },
      notes: form.notes.trim(),
      currency: form.currency,
      pricingListId: form.pricingListId.trim(),
      estimatedDate: form.estimatedDate,
      createdBy: "",
    });
  }

  // Solo cuando la creación terminó bien se descarta lo capturado. El primer valor del token no
  // dispara nada porque el efecto compara contra lo ya visto.
  const seenReset = useRef(resetToken);
  useEffect(() => {
    if (resetToken === seenReset.current) return;
    seenReset.current = resetToken;
    clearDraft();
    setForm(EMPTY);
    setIssues([]);
  }, [resetToken]);

  return (
    <dialog
      ref={dialogRef}
      className="projectDialog"
      aria-labelledby="newProjectTitle"
      onClose={() => {
        // Escape o cierre del navegador: se avisa al padre sin descartar el borrador, para que
        // volver a abrir recupere lo escrito.
        if (open) onCancel();
      }}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <header className="projectDialogHead">
          <h2 id="newProjectTitle">Nuevo proyecto</h2>
          <p>
            Solo el nombre es obligatorio. Todo lo demás se puede completar después desde la ficha del
            solicitante.
          </p>
        </header>

        <div className="projectDialogBody">
          <label className="wide">
            Nombre del proyecto *
            <input
              autoFocus
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Casa Isidro Fabela · cancelería planta alta"
              required
            />
          </label>

          <fieldset>
            <legend>Solicitante</legend>
            <div className="projectDialogGrid">
              <label>Nombre<input value={form.fullName} onChange={(event) => set("fullName", event.target.value)} /></label>
              <label>Empresa<input value={form.company} onChange={(event) => set("company", event.target.value)} /></label>
              <label>
                Teléfono
                <input type="tel" inputMode="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} />
              </label>
              <label>
                Correo
                <input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} />
              </label>
              <label className="wide">
                Canal de origen
                <input
                  list="acquisitionChannels"
                  value={form.acquisitionChannel}
                  onChange={(event) => set("acquisitionChannel", event.target.value)}
                  placeholder="¿Cómo llegó este cliente?"
                />
                {/* Sugerencias, no lista cerrada: el canal real puede ser cualquiera. */}
                <datalist id="acquisitionChannels">
                  {CHANNELS.map((channel) => (
                    <option key={channel} value={channel} />
                  ))}
                </datalist>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Dirección de la obra</legend>
            <div className="projectDialogGrid">
              <label className="wide">Calle y número<input value={form.street} onChange={(event) => set("street", event.target.value)} /></label>
              <label>Ciudad<input value={form.city} onChange={(event) => set("city", event.target.value)} /></label>
              <label>Estado<input value={form.state} onChange={(event) => set("state", event.target.value)} /></label>
              <label>
                Código postal
                <input inputMode="numeric" maxLength={5} value={form.postalCode} onChange={(event) => set("postalCode", event.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Condiciones del proyecto</legend>
            <div className="projectDialogGrid">
              <label>
                Moneda
                <select value={form.currency} onChange={(event) => set("currency", event.target.value)}>
                  <option value="MXN">MXN · peso mexicano</option>
                  <option value="USD">USD · dólar</option>
                  <option value="EUR">EUR · euro</option>
                </select>
              </label>
              <label>
                Fecha estimada
                <input type="date" value={form.estimatedDate} onChange={(event) => set("estimatedDate", event.target.value)} />
              </label>
              <label className="wide">
                Lista de precios o sistema comercial
                <input
                  value={form.pricingListId}
                  onChange={(event) => set("pricingListId", event.target.value)}
                  placeholder="EXWORK Veracruz rev. ABR_22"
                />
              </label>
              <label className="wide">
                Notas iniciales
                <textarea rows={3} value={form.notes} onChange={(event) => set("notes", event.target.value)} />
              </label>
            </div>
          </fieldset>
        </div>

        {(issues.length > 0 || error) && (
          <div className="projectDialogIssues" role="alert">
            {error && <p>⚠ {error}</p>}
            {issues.map((issue) => (
              <p key={issue}>⚠ {issue}</p>
            ))}
            {error && <p className="projectDialogKeep">Lo que capturaste sigue aquí; puedes reintentar.</p>}
          </div>
        )}

        <footer className="projectDialogFoot">
          <button type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button type="submit" className="explorerPrimary" disabled={busy}>
            {busy ? "Creando…" : "Crear y abrir"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
