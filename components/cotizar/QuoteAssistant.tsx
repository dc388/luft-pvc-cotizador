"use client";

import { useState } from "react";

const TIPS = [
  "Elige si vas a cotizar una ventana o una puerta. Puedes agregar más diseños al mismo proyecto después.",
  "La línea disponible usa el catálogo vigente de LUFT PVC para calcular tu propuesta.",
  "Cada estilo muestra una representación de sus hojas y su forma de apertura.",
  "Captura medidas aproximadas. Nuestro especialista confirmará las dimensiones en sitio.",
  "El color que elijas se reflejará de inmediato en la vista previa.",
  "El vidrio cambia aislamiento, seguridad y confort. Elige según la necesidad de tu espacio.",
  "Decide si deseas incluir la instalación profesional de LUFT PVC.",
  "Este precio es preliminar y se recalcula de forma segura en nuestros servidores.",
  "Revisa todas las ventanas de tu proyecto o agrega otra configuración antes de enviarlo.",
  "Aquí puedes conocer, de forma sencilla, cada etapa después de enviar tu cotización.",
  "Déjanos tus datos para crear tu proyecto en LUFT PVC y que un asesor pueda darle seguimiento.",
  "Tu proyecto ya está guardado. Conserva el folio para cualquier seguimiento.",
];

export function QuoteAssistant({ step, supportHref }: { step: number; supportHref: string }) {
  const [open, setOpen] = useState(false);
  const tip = TIPS[step] ?? TIPS[0];

  return (
    <aside className={`cotAssistant ${open ? "isOpen" : ""}`} aria-label="Asistente de cotización LUFT">
      {open ? (
        <div className="cotAssistantPanel">
          <div className="cotAssistantIdentity">
            <span aria-hidden="true">L</span>
            <div><b>Lía</b><small>Asistente LUFT</small></div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar asistente">×</button>
          </div>
          <p>{tip}</p>
          <a href={supportHref} target="_blank" rel="noopener noreferrer">Hablar con un asesor</a>
        </div>
      ) : (
        <button className="cotAssistantTrigger" onClick={() => setOpen(true)} aria-expanded="false">
          <i aria-hidden="true">✦</i><span><b>¿Necesitas ayuda?</b><small>Lía · Asistente LUFT</small></span>
        </button>
      )}
    </aside>
  );
}
