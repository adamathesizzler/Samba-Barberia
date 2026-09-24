import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { DemoBackend } from "../domain/backend";
import { createSeed, demoToday, DEMO, SEED_VERSION } from "../domain/seed";
import { addMinutes } from "../domain/time";
import type { Actor, DemoState } from "../domain/types";

const STATE_KEY = "samba.demo.state.v1";
const CLOCK_KEY = "samba.demo.now.v1";
const ROLE_KEY = "samba.demo.role.v1";

// El almacenamiento del navegador es solo una comodidad de la demo: si falla, todo sigue en memoria.
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* sin persistencia */
  }
};

export type RoleKey = "cliente" | "david" | "sara" | "propietaria";

export const ROLES: Record<RoleKey, { label: string; actor: Actor; home: string }> = {
  cliente: { label: "Cliente · Nico", actor: { kind: "cliente", customerId: DEMO.customer }, home: "/cliente/inicio" },
  david: { label: "Barbero · David", actor: { kind: "staff", staffId: DEMO.david, businessId: DEMO.business, role: "barbero" }, home: "/pro/hoy" },
  sara: { label: "Barbera · Sara", actor: { kind: "staff", staffId: DEMO.sara, businessId: DEMO.business, role: "barbero" }, home: "/pro/hoy" },
  propietaria: { label: "Propietaria · Marta", actor: { kind: "staff", staffId: DEMO.owner, businessId: DEMO.business, role: "propietario" }, home: "/gestion" },
};

function boot() {
  const today = demoToday();
  let now = read(CLOCK_KEY) ?? today;
  let state: DemoState | null = null;
  try {
    const saved = read(STATE_KEY);
    if (saved) state = JSON.parse(saved);
  } catch {
    state = null;
  }
  // Una demo guardada de otro día se regenera para que la agenda de «hoy» tenga sentido.
  if (!state || state.version !== SEED_VERSION || now.slice(0, 10) < today.slice(0, 10)) {
    now = today;
    state = createSeed(now);
  }
  return { state, now };
}

interface Ctx {
  be: DemoBackend;
  state: DemoState;
  now: string;
  role: RoleKey;
  actor: Actor;
  setRole: (r: RoleKey) => void;
  advance: (min: number) => void;
  reset: () => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [{ be, clock }] = useState(() => {
    const init = boot();
    const clock = { now: init.now };
    const be = new DemoBackend(init.state, () => clock.now, (s) => write(STATE_KEY, JSON.stringify(s)));
    return { be, clock };
  });
  const state = useSyncExternalStore(be.subscribe, be.getState);
  const [now, setNow] = useState(clock.now);
  const [role, setRoleState] = useState<RoleKey>(() => (read(ROLE_KEY) as RoleKey) ?? "cliente");
  const [toastMsg, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const value = useMemo<Ctx>(
    () => ({
      be,
      state,
      now,
      role,
      actor: ROLES[role]?.actor ?? ROLES.cliente.actor,
      setRole: (r) => {
        write(ROLE_KEY, r);
        setRoleState(r);
      },
      advance: (min) => {
        clock.now = addMinutes(clock.now, min);
        write(CLOCK_KEY, clock.now);
        setNow(clock.now);
        be.tick();
      },
      reset: () => {
        clock.now = demoToday();
        write(CLOCK_KEY, null);
        setNow(clock.now);
        be.replaceState(createSeed(clock.now));
      },
      toast: setToast,
      toastMsg,
    }),
    [be, clock, state, now, role, toastMsg],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("StoreProvider ausente");
  return ctx;
}
