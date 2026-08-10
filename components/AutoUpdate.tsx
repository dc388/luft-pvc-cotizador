"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 30_000;
const RELOAD_DELAY_MS = 1_800;

// Mantiene las pestañas abiertas alineadas con el Worker permanente. Cada despliegue cambia
// __LUFT_BUILD_ID__, así que el cliente se actualiza sin recibir otro enlace.
export function AutoUpdate() {
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (__LUFT_BUILD_ID__ === "development") return;

    let active = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    async function checkVersion() {
      if (!active || reloadTimer) return;
      try {
        const response = await fetch(`/api/version?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "cache-control": "no-cache" },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { version?: string };
        if (!payload.version || payload.version === __LUFT_BUILD_ID__) return;

        setUpdating(true);
        reloadTimer = setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
      } catch {
        // Una pérdida temporal de red no interrumpe la cotización. El próximo intervalo
        // vuelve a intentarlo cuando el servidor sea accesible.
      }
    }

    const interval = window.setInterval(checkVersion, POLL_INTERVAL_MS);
    const initial = window.setTimeout(checkVersion, 4_000);
    const onFocus = () => void checkVersion();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.clearTimeout(initial);
      if (reloadTimer) window.clearTimeout(reloadTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!updating) return null;
  return <div className="appUpdateToast" role="status" aria-live="polite">Actualizando el cotizador…</div>;
}
