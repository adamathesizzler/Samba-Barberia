import { useEffect, useState } from "react";

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

export const navigate = (path: string) => {
  location.hash = path;
};

export const back = (fallback: string) => {
  if (history.length > 1) history.back();
  else navigate(fallback);
};
