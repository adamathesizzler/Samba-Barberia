import { useEffect, useState } from "react";
import { navigate, useRoute } from "./app/router";
import { ROLES, useStore, type RoleKey } from "./app/store";
import { datePart, formatDay, timePart } from "./domain/time";
import { upcomingAppointments } from "./domain/queries";
import { Icon, type IconName } from "./ui/Icon";
import { Home } from "./screens/cliente/Home";
import { Explore, ExploreDetail } from "./screens/cliente/Explore";
import { Booking } from "./screens/cliente/Booking";
import { AppointmentDetail, Pass } from "./screens/cliente/Appointment";
import { Prepare } from "./screens/cliente/Prepare";
import { History, VisitDetail } from "./screens/cliente/History";
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

function DemoBar() {
  const { role, setRole, now, advance, reset } = useStore();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="demo-bar glass" role="region" aria-label="Controles de demostración">
      <div className="inner">
        <span className="badge sim">Modo demostración · datos ficticios</span>
        <select
          value={role}
          aria-label="Ver la app como"
          onChange={(e) => {
            const r = e.target.value as RoleKey;
            setRole(r);
            navigate(ROLES[r].home);
          }}
        >
          {Object.entries(ROLES).map(([k, r]) => (
            <option key={k} value={k}>
              {r.label}
            </option>
          ))}
        </select>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="code">{timePart(now)}</span> · {formatDay(now).split(" de ")[0]}
        </button>
        {open && (
          <>
            <button onClick={() => advance(15)}>+15 min</button>
            <button onClick={() => advance(60)}>+1 h</button>
            <button onClick={() => advance(60 * 24)}>+1 día</button>
            {confirmReset ? (
              <>
                <span>¿Borrar los cambios de esta demo?</span>
                <button
                  onClick={() => {
                    reset();
                    setConfirmReset(false);
                    navigate(ROLES[role].home);
                  }}
                >
                  Sí, reiniciar
                </button>
                <button onClick={() => setConfirmReset(false)}>No</button>
              </>
            ) : (
              <button onClick={() => setConfirmReset(true)}>Reiniciar demo</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ClientNav({ current }: { current: string }) {
  const { state, actor, now } = useStore();
  const items: { key: string; label: string; icon: IconName }[] = [
    { key: "inicio", label: "Inicio", icon: "home" },
    { key: "explorar", label: "Explorar", icon: "compass" },
    { key: "historial", label: "Historial", icon: "history" },
    { key: "perfil", label: "Perfil", icon: "user" },
  ];
  const next = actor.kind === "cliente" ? upcomingAppointments(state, actor.customerId, now)[0] : undefined;
  // Banda contextual (R08): solo el día de la cita y si aporta algo.
  const showBand = next && datePart(next.start) === datePart(now) && current !== "pase" && current !== "reservar";
  const hideNav = ["reservar", "pase"].includes(current);
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
        <div className="nav glass">
          {items.slice(0, 4).map((it) => (
            <a key={it.key} href={`#/cliente/${it.key}`} aria-current={current === it.key ? "page" : undefined}>
              <Icon name={it.icon} size={20} />
              {it.label}
            </a>
          ))}
        </div>
        <a className="fab" href="#/cliente/reservar" aria-label="Reservar">
          <div style={{ display: "grid", placeItems: "center" }}>
            <Icon name="plus" size={22} strokeWidth={2.2} />
            <span>Reservar</span>
          </div>
        </a>
      </div>
    </nav>
  );
}

function ProNav({ current }: { current: string }) {
  const { actor } = useStore();
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
        <div className="nav glass">
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
    if (!allowed) navigate(ROLES[role].home);
  }, [area, expected, role]);

  let content: React.ReactNode = null;
  if (area === "cliente" && actor.kind === "cliente") {
    content =
      {
        inicio: <Home />,
        explorar: id ? <ExploreDetail photoId={id} /> : <Explore />,
        reservar: <Booking query={query} />,
        cita: <AppointmentDetail id={id} />,
        pase: <Pass id={id} />,
        preparar: <Prepare id={id} />,
        historial: <History tab={query.get("tab") ?? "visitas"} />,
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
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
