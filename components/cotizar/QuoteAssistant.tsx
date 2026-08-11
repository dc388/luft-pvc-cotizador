"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { AssistantBrief } from "@/lib/assistantBrief";
import { buildPublicAssistantReply, publicAssistantRequestContext, type PublicAssistantAction, type PublicAssistantContext } from "./publicAssistant";
import styles from "./QuoteAssistant.module.css";

type Message = { id: string; role: "assistant" | "user"; text: string };

const MEMORY_KEY = "luft-public-advisor-v1";
const GREETING = "Hola, soy LUFT Asesor. Puedo ayudarte a elegir, configurar y cotizar tu ventana o puerta. ¿En qué parte necesitas ayuda?";
// "¿Por qué cambió el precio?" salió de esta lista: ya no hay un precio en pantalla que pudiera
// cambiar, y ofrecerlo como atajo invitaba a buscar una cifra que solo existe en el documento.
const QUICK_REPLIES = ["Ayúdame a elegir", "Explícame las aperturas", "Revisa mis medidas", "Revisa mi configuración", "¿Cómo recibo mi cotización?"];

function message(role: Message["role"], text: string): Message {
  return { id: crypto.randomUUID(), role, text };
}

export function QuoteAssistant({
  context,
  onApply,
  supportHref,
  humanAvailable,
}: {
  context: PublicAssistantContext;
  onApply: (action: PublicAssistantAction) => void;
  supportHref: string;
  humanAvailable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([message("assistant", GREETING)]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [pending, setPending] = useState<PublicAssistantAction | null>(null);
  const [memoryReady, setMemoryReady] = useState(false);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  // Estado acumulado de lo que el cliente ha dicho (medidas, ubicación, prioridades). Viaja al
  // servidor en cada turno y vuelve fusionado, así que sobrevive a los re-render y es lo que
  // evita volver a preguntar lo ya contestado. En un ref, no en estado: cambiarlo no debe
  // repintar el chat, solo acompañar la siguiente petición.
  const briefRef = useRef<AssistantBrief>({});

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(MEMORY_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed) && parsed.length) {
          setMessages(parsed.slice(-30).filter((entry) => entry && (entry.role === "assistant" || entry.role === "user") && typeof entry.text === "string"));
        }
      } catch {
        sessionStorage.removeItem(MEMORY_KEY);
      } finally {
        setMemoryReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!memoryReady) return;
    try {
      sessionStorage.setItem(MEMORY_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // El asistente sigue funcionando aunque el navegador bloquee sessionStorage.
    }
    messageEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [memoryReady, messages, typing]);

  // Estado acumulado de lo que el cliente ha dicho. Viaja al servidor en cada turno y vuelve
  // fusionado; es lo que evita que el asistente vuelva a preguntar lo ya contestado.
  async function ask(raw: string) {
    const question = raw.trim().slice(0, 500);
    if (!question || typing) return;
    const conversation = messages.slice(-8).map(({ role, text }) => ({ role, text }));
    setMessages((current) => [...current, message("user", question)]);
    setInput("");
    setPending(null);
    setTyping(true);
    try {
      const response = await fetch("/api/public-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: question, history: conversation, context: publicAssistantRequestContext(context), brief: briefRef.current }),
      });
      const payload = (await response.json()) as { text?: string; action?: PublicAssistantAction; brief?: AssistantBrief; error?: string };
      if (!response.ok || !payload.text) throw new Error(payload.error ?? "No pudimos consultar LUFT Asesor.");
      if (payload.brief) briefRef.current = payload.brief;
      setMessages((current) => [...current, message("assistant", payload.text!)]);
      setPending(payload.action ?? null);
    } catch (error) {
      if (error instanceof Error && error.message.includes("demasiadas solicitudes")) {
        setMessages((current) => [...current, message("assistant", error.message)]);
      } else {
        const reply = buildPublicAssistantReply(question, context, briefRef.current);
        setMessages((current) => [...current, message("assistant", reply.text)]);
        setPending(reply.action ?? null);
      }
    } finally {
      setTyping(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  function applyPending() {
    if (!pending) return;
    onApply(pending);
    setMessages((current) => [...current, message("assistant", "Listo. Apliqué únicamente el cambio autorizado; el servidor volverá a revisar que la configuración se pueda fabricar.")]);
    setPending(null);
  }

  return (
    <aside className={styles.root} aria-label="LUFT Asesor">
      {open ? (
        <section className={styles.panel} role="dialog" aria-label="Conversación con LUFT Asesor">
          <header className={styles.head}>
            <span className={styles.avatar} aria-hidden="true">L</span>
            <span className={styles.identity}><b>LUFT Asesor</b><small>Ayuda contextual · datos públicos</small></span>
            <button className={styles.close} onClick={() => setOpen(false)} aria-label="Minimizar LUFT Asesor">×</button>
          </header>
          <div className={styles.messages} aria-live="polite" aria-busy={typing}>
            {messages.map((entry) => <p key={entry.id} className={`${styles.message} ${styles[entry.role]}`}>{entry.text}</p>)}
            {typing && <span className={styles.typing} aria-label="LUFT Asesor está escribiendo"><i /><i /><i /></span>}
            <div ref={messageEndRef} />
          </div>
          {pending && (
            <div className={styles.confirm}>
              <button onClick={applyPending}>Aplicar cambio</button>
              <button onClick={() => { setPending(null); setMessages((current) => [...current, message("assistant", "Entendido. No modifiqué nada.")]); }}>Cancelar</button>
            </div>
          )}
          <div className={styles.quick} aria-label="Respuestas rápidas">
            {QUICK_REPLIES.map((reply) => <button key={reply} onClick={() => void ask(reply)} disabled={typing}>{reply}</button>)}
          </div>
          {humanAvailable && <a className={styles.human} href={supportHref} target="_blank" rel="noopener noreferrer">Continuar con un asesor humano</a>}
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.srOnly} htmlFor="luft-advisor-input">Escribe tu pregunta</label>
            <input id="luft-advisor-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Ayuda en: ${context.stepName}`} maxLength={500} autoComplete="off" />
            <button type="submit" disabled={!input.trim() || typing} aria-label="Enviar pregunta">↑</button>
          </form>
        </section>
      ) : (
        <button className={styles.trigger} onClick={() => setOpen(true)} aria-expanded="false" aria-label="Abrir LUFT Asesor">
          <i aria-hidden="true">✦</i><span><b>¿Necesitas ayuda?</b><small>LUFT Asesor</small></span>
        </button>
      )}
    </aside>
  );
}
