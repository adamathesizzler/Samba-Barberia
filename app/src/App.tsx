import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { navigate, useRoute } from "./app/router";
import { ROLES, useStore, type RoleKey } from "./app/store";
import { datePart, formatDay, timePart } from "./domain/time";
import { upcomingAppointments } from "./domain/queries";
import { Icon, type IconName } from "./ui/Icon";
import { Sheet } from "./ui/common";
import { Home } from "./screens/cliente/Home";
import { Welcome, welcomeSeen } from "./screens/cliente/Welcome";
import { Explore, ExploreDetail } from "./screens/cliente/Explore";
import { Booking } from "./screens/cliente/Booking";
import { AppointmentDetail, Pass } from "./screens/cliente/Appointment";
import { Prepare } from "./screens/cliente/Prepare";
import { History, VisitDetail } from "./screens/cliente/History";
import { Citas } from "./screens/cliente/Citas";
import { Profile, Settings, Privacy, Preferences } from "./screens/cliente/Profile";
import { Rewards, Activity, Waitlist, StyleAI } from "./screens/cliente/Rewards";
import { Today, Scan, Redeem, WalkIn } from "./screens/barbero/Today";
import { SessionCardScreen } from "./screens/barbero/SessionCard";
import { CloseSession } from "./screens/barbero/CloseSession";
import { Management } from "./screens/barbero/Management";

const THEME_KEY = "samba.theme";

export function useTheme() {
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as "light" | "dark") ?? "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* sin persistencia */
    }
  }, [theme]);
  return [theme, setTheme] as const;
}


/** Coloca una pastilla bajo el enlace activo y la desliza al cambiar de pestaña. */
function useNavPill(current: string) {
  const nav = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const a = nav.current?.querySelector<HTMLElement>('a[aria-current="page"]');
    const p = pill.current;
    if (!p) return;
    if (!a) {
      p.style.opacity = "0";
      return;
    }
    p.style.transition = first.current ? "none" : "";
    p.style.opacity = "1";
    p.style.width = `${a.offsetWidth}px`;
    p.style.transform = `translateX(${a.offsetLeft}px)`;
    first.current = false;
  }, [current]);
  return { nav, pill };
}

function Toast({ msg }: { msg: string | null }) {
  const [text, setText] = useState(msg);
  useEffect(() => {
    if (msg) setText(msg);
  }, [msg]);
  if (!text) return null;
  return (
    <div className={`toast ${msg ? "in" : "out"}`} role="status" onTransitionEnd={() => !msg && setText(null)}>
      {text}
    </div>
  );
}

/**
 * Controles de la demo en un botón discreto (arriba, centrado) que abre una hoja.
 * Así la app se ve como una app y no como una herramienta de desarrollo.
 */
function DemoBar() {
  const { role, setRole, now, advance, reset } = useStore();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <>
      <button className="demo-pill" onClick={() => setOpen(true)} aria-label="Controles de la demostración">
        <span className="dot" aria-hidden="true" /> Demo
      </button>
      {open && (
        <Sheet title="Demostración" onClose={() => setOpen(false)}>
          <p className="small muted">Datos ficticios y fotos de muestra (Unsplash). Los cambios se guardan solo en este navegador.</p>
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">Ver la app como</span>
            <div className="menu">
              {(Object.entries(ROLES) as [RoleKey, (typeof ROLES)[RoleKey]][]).map(([k, r]) => (
                <button
                  key={k}
                  onClick={() => {
                    setRole(k);
                    setOpen(false);
                    navigate(ROLES[k].home);
                  }}
                >
                  <span className="grow">{r.label}</span>
                  {role === k && <Icon name="check" size={18} />}
                </button>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">
              Reloj de la demo · {timePart(now)} · {formatDay(now).split(" de ")[0]}
            </span>
            <div className="row">
              <button className="btn outline sm grow" onClick={() => advance(15)}>
                +15 min
              </button>
              <button className="btn outline sm grow" onClick={() => advance(60)}>
                +1 h
              </button>
              <button className="btn outline sm grow" onClick={() => advance(60 * 24)}>
                +1 día
              </button>
            </div>
          </div>
          {confirmReset ? (
            <div className="row">
              <button
                className="btn danger grow"
                onClick={() => {
                  reset();
                  setConfirmReset(false);
                  setOpen(false);
                  navigate(ROLES[role].home);
                }}
              >
                Sí, borrar cambios
              </button>
              <button className="btn outline" onClick={() => setConfirmReset(false)}>
                No
              </button>
            </div>
          ) : (
            <button className="btn ghost" onClick={() => setConfirmReset(true)}>
              Reiniciar demo
            </button>
          )}
        </Sheet>
      )}
    </>
  );
}

function ClientNav({ current }: { current: string }) {
  const { state, actor, now } = useStore();
  const { nav, pill } = useNavPill(current);
  const items: { key: string; label: string; icon: IconName }[] = [
    { key: "inicio", label: "Inicio", icon: "home" },
    { key: "explorar", label: "Explorar", icon: "compass" },
    { key: "citas", label: "Citas", icon: "calendar" },
    { key: "perfil", label: "Perfil", icon: "user" },
  ];
  const next = actor.kind === "cliente" ? upcomingAppointments(state, actor.customerId, now)[0] : undefined;
  // Banda contextual (R08): solo el día de la cita y si aporta algo.
  const showBand = next && datePart(next.start) === datePart(now) && !["pase", "reservar", "inicio", "bienvenida"].includes(current);
  const hideNav = ["reservar", "pase", "bienvenida"].includes(current);
  if (hideNav) return null;
  return (
    <nav className="bottom" aria-label="Navegación principal">
      {showBand && (
        <div className="context-band glass">
          <Icon name="clock" size={16} />
          <span>
            {next.status === "llegada" || next.status === "en_atencion" ? "Llegada registrada" : "Próxima cita"} · <b>{timePart(next.start)}</b>
          </span>
          {next.status === "confirmada" || next.status === "modificada" ? (
            <button className="btn primary sm" onClick={() => navigate(`/cliente/pase/${next.id}`)}>
              Ver QR
            </button>
          ) : (
            <button className="btn outline sm" onClick={() => navigate(`/cliente/cita/${next.id}`)}>
              Ver
            </button>
          )}
        </div>
      )}
      <div className="nav-row">
        <div className="nav glass orbnav" ref={nav}>
          <span className="nav-pill" ref={pill} aria-hidden="true" />
          {items.map((it, i) => (
            <Fragment key={it.key}>
              {i === 2 && (
                <span className="orb-slot">
                  <a className="orb" href="#/cliente/reservar" aria-label="Reservar">
                    <Icon name="plus" size={26} strokeWidth={2.4} />
                  </a>
                </span>
              )}
              <a href={`#/cliente/${it.key}`} aria-current={current === it.key ? "page" : undefined}>
                <Icon name={it.icon} size={20} />
                {it.label}
              </a>
            </Fragment>
          ))}
        </div>
      </div>
    </nav>
  );
}

function ProNav({ current }: { current: string }) {
  const { actor } = useStore();
  const { nav, pill } = useNavPill(current);
  const owner = actor.kind === "staff" && actor.role === "propietario";
  const items: { key: string; label: string; icon: IconName; href: string }[] = [
    { key: "hoy", label: owner ? "Agenda" : "Hoy", icon: "calendar", href: "#/pro/hoy" },
    { key: "escanear", label: "Escanear", icon: "scan", href: "#/pro/escanear" },
    { key: "canjear", label: "Canjear", icon: "gift", href: "#/pro/canjear" },
    ...(owner ? [{ key: "gestion", label: "Gestión", icon: "settings" as IconName, href: "#/gestion" }] : []),
  ];
  if (["finalizar"].includes(current)) return null;
  return (
    <nav className="bottom" aria-label="Navegación del profesional">
      <div className="nav-row">
        <div className="nav glass pronav" ref={nav}>
          <span className="nav-pill" ref={pill} aria-hidden="true" />
          {items.map((it) => (
            <a key={it.key} href={it.href} aria-current={current === it.key ? "page" : undefined}>
              <Icon name={it.icon} size={20} />
              {it.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  const { parts, query } = useRoute();
  const { actor, role, toastMsg } = useStore();
  const [area, screen = "", id] = parts;

  // Cada rol solo navega por su área: la URL no concede acceso.
  const expected = actor.kind === "cliente" ? "cliente" : "pro";
  useEffect(() => {
    const allowed = expected === "cliente" ? area === "cliente" : area === "pro" || (area === "gestion" && role === "propietaria");
    // La primera vez que entra un cliente ve la bienvenida.
    if (!allowed) navigate(role === "cliente" && !welcomeSeen() ? "/cliente/bienvenida" : ROLES[role].home);
  }, [area, expected, role]);

  // Los enlaces internos pasan por navigate() para tener transición de vista.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element).closest?.('a[href^="#/"]');
      if (!a) return;
      e.preventDefault();
      navigate(a.getAttribute("href")!.slice(1));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  let content: React.ReactNode = null;
  if (area === "cliente" && actor.kind === "cliente") {
    content =
      {
        inicio: <Home />,
        bienvenida: <Welcome />,
        explorar: id ? <ExploreDetail photoId={id} /> : <Explore />,
        reservar: <Booking query={query} />,
        cita: <AppointmentDetail id={id} />,
        pase: <Pass id={id} />,
        preparar: <Prepare id={id} />,
        citas: <Citas tab={query.get("tab")} />,
        historial: <Citas tab="pasadas" />,
        looks: <History tab="estilo" />,
        visita: <VisitDetail id={id} />,
        perfil: <Profile />,
        recompensas: <Rewards />,
        actividad: <Activity />,
        preferencias: <Preferences />,
        privacidad: <Privacy />,
        ajustes: <Settings />,
        espera: <Waitlist />,
        "style-ai": <StyleAI />,
      }[screen] ?? <Home />;
  } else if (area === "pro" && actor.kind === "staff") {
    content =
      {
        hoy: <Today />,
        escanear: <Scan />,
        ficha: <SessionCardScreen id={id} />,
        finalizar: <CloseSession id={id} />,
        canjear: <Redeem />,
        "sin-reserva": <WalkIn />,
      }[screen] ?? <Today />;
  } else if (area === "gestion" && role === "propietaria") {
    content = <Management />;
  }

  return (
    <div className="shell">
      <DemoBar />
      <main key={`${area}/${screen}/${id ?? ""}`}>{content}</main>
      {area === "cliente" && actor.kind === "cliente" && <ClientNav current={screen || "inicio"} />}
      {(area === "pro" || area === "gestion") && actor.kind === "staff" && <ProNav current={area === "gestion" ? "gestion" : screen || "hoy"} />}
      <Toast msg={toastMsg} />
    </div>
  );
}
