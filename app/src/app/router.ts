import { useEffect, useState } from "react";
import { reducedMotion } from "../ui/motion";

/** Router mínimo por hash: #/cliente/cita/apt_1?x=y */
export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { parts: path.split("/").filter(Boolean), query: new URLSearchParams(query) };
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash());
  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

// Pestañas principales: moverse entre ellas es lateral (fundido), no «entrar» ni «salir».
const TABS = new Set(["inicio", "explorar", "historial", "perfil", "hoy", "escanear", "canjear", "gestion"]);
const depth = (path: string) => {
  const parts = path.replace(/^#?\/?/, "").split("?")[0].split("/").filter(Boolean);
  const screen = parts[0] === "gestion" ? "gestion" : parts[1];
  return !screen || TABS.has(screen) ? 0 : parts.length;
};

type VT = { finished: Promise<void> };
type DocWithVT = Document & { startViewTransition?: (cb: () => Promise<void>) => VT };

/**
 * Cambia de ruta con transición de vista cuando el navegador la soporta:
 * adelante desliza desde la derecha, atrás hacia la derecha, entre pestañas funde.
 * `shared` es un elemento (p. ej. una foto) que se expande con continuidad hasta la pantalla siguiente.
 */
function transition(apply: () => void, dir: "forward" | "back" | "fade", shared?: HTMLElement | null) {
  const doc = document as DocWithVT;
  if (!doc.startViewTransition || reducedMotion()) {
    apply();
    return;
  }
  document.documentElement.dataset.nav = dir;
  if (shared) shared.style.viewTransitionName = "foto";
  const vt = doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        const done = () => requestAnimationFrame(() => resolve());
        window.addEventListener("hashchange", done, { once: true });
        apply();
        // Si el hash no cambia (misma ruta), no esperamos para siempre.
        setTimeout(resolve, 300);
      }),
  );
  vt.finished.finally(() => {
    if (shared) shared.style.viewTransitionName = "";
    delete document.documentElement.dataset.nav;
  });
}

export const navigate = (path: string, shared?: HTMLElement | null) => {
  const from = depth(location.hash);
  const to = depth(path);
  transition(() => (location.hash = path), to > from ? "forward" : to < from ? "back" : "fade", shared);
};

export const back = (fallback: string) => {
  if (history.length > 1) transition(() => history.back(), "back");
  else navigate(fallback);
};
