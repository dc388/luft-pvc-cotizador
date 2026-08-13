"use client";

/**
 * Un dato guardado en `localStorage`, leído como lo que es: estado de un sistema externo.
 *
 * Existe para que las preferencias persistidas se lean con `useSyncExternalStore` en vez de con el
 * patrón "estado + efecto que lo rellena al montar". Ese patrón tenía dos problemas: provocaba un
 * render extra en cada carga (y el compilador de React lo marca como error), y no reaccionaba a lo
 * que hiciera otra pestaña del mismo navegador.
 *
 * `getServerSnapshot` devuelve siempre el valor por omisión, que es lo que resuelve el desajuste de
 * hidratación: el servidor no tiene `localStorage`, así que renderiza el valor por omisión y React
 * vuelve a renderizar con el valor real una vez hidratado, sin marcar discrepancia.
 *
 * La instantánea se memoriza porque `useSyncExternalStore` compara por identidad: devolver un objeto
 * nuevo en cada lectura provocaría un bucle infinito de renders.
 */

export type LocalStore<T> = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (next: T) => void;
};

export function createLocalStore<T>(key: string, fallback: T, normalize: (raw: unknown) => T): LocalStore<T> {
  let cached: T = fallback;
  let loaded = false;
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  function read(): T {
    if (loaded) return cached;
    loaded = true;
    if (typeof window === "undefined") return cached;
    try {
      const raw = window.localStorage.getItem(key);
      cached = raw === null ? fallback : normalize(JSON.parse(raw));
    } catch {
      // Almacenamiento deshabilitado o contenido ilegible: se usa el valor por omisión.
      cached = fallback;
    }
    return cached;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      // El evento `storage` solo llega desde OTRAS pestañas, que es justo lo que interesa vigilar:
      // los cambios de esta pestaña ya pasan por `set`.
      const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== key) return;
        loaded = false;
        read();
        notify();
      };
      if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot: read,
    getServerSnapshot: () => fallback,
    set(next) {
      cached = next;
      loaded = true;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Sin almacenamiento el valor vive solo en memoria hasta que se recargue.
        }
      }
      notify();
    },
  };
}
