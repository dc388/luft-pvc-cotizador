"use client";

import { useEffect, useRef, useState } from "react";

// Piezas base del lenguaje Liquid Glass del cotizador público.
//
// Los estilos viven en app/globals.css sobre los tokens --cg-* que ya define .cotShell
// (--cg-tint, --cg-edge, --cg-line, --cg-shadow, --cg-accent...). Estos componentes no
// declaran colores propios: si mañana cambia la paleta, cambia en un solo lugar.

type GlassCardProps = {
  children: React.ReactNode;
  /** "plain" es la superficie normal; "tinted" es la variante teñida para destacar (precio). */
  variant?: "plain" | "tinted";
  className?: string;
};

export function GlassCard({ children, variant = "plain", className = "" }: GlassCardProps) {
  return <div className={`glassCard ${variant === "tinted" ? "glassCardTinted" : ""} ${className}`}>{children}</div>;
}

export function GlassBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "warn" }) {
  return <span className={`glassBadge glassBadge-${tone}`}>{children}</span>;
}

export function GlassChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="glassChip">
      <i aria-hidden="true">{icon}</i>
      {children}
    </span>
  );
}

/** Número grande en cápsula de vidrio, como el indicador de paso de las referencias. */
export function GlassNumber({ n }: { n: number }) {
  return (
    <span className="glassNumber" aria-hidden="true">
      {n}
    </span>
  );
}

// Revela el contenido al entrar al viewport (opacity/translateY/blur), una sola vez.
//
// El contenido está VISIBLE por defecto y solo se oculta si este efecto decide animarlo. Es a
// propósito: la primera versión hacía lo contrario -- nacía oculto y solo aparecía si el
// IntersectionObserver disparaba -- y bastó una pestaña sin componer para dejar las 7 cards
// invisibles. Una animación no puede ser el requisito para poder leer la página.
//
// Tres protecciones, en orden:
//  1. No se oculta nada que ya esté a la vista al montar (evita además el parpadeo de carga).
//  2. Si hay movimiento reducido o no existe IntersectionObserver, no se anima en absoluto.
//  3. Aunque el observer nunca dispare (pestaña en segundo plano, render suspendido), un
//     temporizador de seguridad muestra el contenido igual.
//
// IntersectionObserver y no listeners de scroll: el navegador resuelve la intersección fuera
// del hilo principal, que es lo que permite animar 7 cards en un teléfono sin que se note.
export function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;
    // Ya visible al montar: se deja tal cual.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setHidden(true);
    let settled = false;
    const show = () => {
      if (settled) return;
      settled = true;
      setHidden(false);
      io.disconnect();
      clearTimeout(safety);
    };
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.05,
    });
    io.observe(el);
    const safety = setTimeout(show, 2500);

    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
  }, []);

  return (
    <div ref={ref} className={`glassReveal ${hidden ? "isHidden" : ""}`}>
      {children}
    </div>
  );
}
