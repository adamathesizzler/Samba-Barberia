// Movimiento y respuesta táctil. Criterios: respuesta al pulsar (no al soltar), transiciones
// interrumpibles, continuidad espacial y versión suave con «reducir movimiento».

import { useEffect, useRef, useState } from "react";

export const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/**
 * Vibración breve solo en momentos con significado (reserva confirmada, llegada, premio).
 * Si el dispositivo o el visor no lo permiten, no pasa nada.
 */
export function haptic(kind: "light" | "success" | "warning" = "light") {
  try {
    navigator.vibrate?.(kind === "success" ? [12, 40, 18] : kind === "warning" ? [30, 30, 30] : 8);
  } catch {
    /* sin vibración */
  }
}

/** Cuenta desde 0 hasta `to` una vez al montar (momento poco frecuente: se permite el detalle). */
export function useCountUp(to: number, ms = 700) {
  const [value, setValue] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      // ease-out fuerte: arranca rápido, termina suave
      const e = 1 - Math.pow(1 - p, 4);
      setValue(Math.round(to * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return value;
}

/**
 * Parallax de una cabecera fotográfica: la foto se desplaza más despacio que el contenido
 * y se amplía al estirar hacia abajo. Escribe `transform` directamente (sin re-render).
 */
export function useParallax<T extends HTMLElement>(factor = 0.35) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const y = window.scrollY;
      el.style.transform = y >= 0 ? `translate3d(0, ${y * factor}px, 0) scale(${1 + Math.min(y, 400) * 0.0004})` : `scale(${1 + -y * 0.002})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [factor]);
  return ref;
}

/**
 * Inclinación 3D sutil que sigue al puntero, con muelle (interpolación hacia el objetivo) para que
 * tenga inercia. Solo con ratón o trackpad: en táctil no hay hover.
 */
export function useTilt<T extends HTMLElement>(max = 5) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let tx = 0,
      ty = 0,
      x = 0,
      y = 0,
      raf = 0;
    const loop = () => {
      // Muelle críticamente amortiguado aproximado: se acerca al objetivo sin rebotar.
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.transform = `perspective(900px) rotateX(${y}deg) rotateY(${x}deg)`;
      if (Math.abs(tx - x) > 0.01 || Math.abs(ty - y) > 0.01) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2 * max;
      ty = -((e.clientY - r.top) / r.height - 0.5) * 2 * max;
      kick();
    };
    const leave = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, [max]);
  return ref;
}
