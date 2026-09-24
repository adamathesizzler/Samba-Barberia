// 01 · Inicio (diseño v1.0): hero oscuro con foto, próxima cita en cristal, accesos rápidos,
// últimos looks y Style AI. Añade lo que el concepto pedía: tarjeta que cambia con el momento,
// avisos, datos breves y progreso de recompensa.

import { useState } from "react";
import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { customerSessions, loyaltyProgress, upcomingAppointments, visitRhythm } from "../../domain/queries";
import { datePart, daysBetween, formatRelativeDay, parseLocal, timePart } from "../../domain/time";
import type { Appointment } from "../../domain/types";
import { Icon, type IconName } from "../../ui/Icon";
import { Notice, PhotoArt } from "../../ui/common";
import { capitalize } from "../../ui/product";
import { useParallax } from "../../ui/motion";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const shortDate = (s: string) => {
  const d = parseLocal(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

const STATE_LABEL: Record<Appointment["status"], string> = {
  confirmada: "Confirmada",
  modificada: "Modificada",
  llegada: "Llegada registrada",
  en_atencion: "En atención",
  cancelada: "Cancelada",
  completada: "Completada",
  ausencia: "Ausencia",
};

/** La acción de la próxima cita cambia con el momento: preparar, mostrar QR o ver estado. */
function nextAction(appt: Appointment, isToday: boolean): { label: string; to: string; icon: IconName } {
  if (appt.status === "llegada" || appt.status === "en_atencion") return { label: "Ver estado", to: `/cliente/cita/${appt.id}`, icon: "check" };
  if (isToday) return { label: "Mostrar QR", to: `/cliente/pase/${appt.id}`, icon: "qr" };
  return { label: "Preparar visita", to: `/cliente/preparar/${appt.id}`, icon: "sparkle" };
}

export function Home() {
  const { state, actor, now } = useStore();
  const heroRef = useParallax<HTMLDivElement>(0.3);
  const [firstVisit] = useState(() => {
    // La entrada escalonada solo la primera vez por sesión: Inicio se ve muchas veces al día.
    try {
      if (sessionStorage.getItem("samba.home.seen")) return false;
      sessionStorage.setItem("samba.home.seen", "1");
    } catch {
      return false;
    }
    return true;
  });
  if (actor.kind !== "cliente") return null;

  const me = state.customers.find((c) => c.id === actor.customerId)!;
  const next = upcomingAppointments(state, me.id, now)[0];
  const sessions = customerSessions(state, me.id);
  const last = sessions[0];
  const lastEntry = last && state.styleEntries.find((e) => e.sessionId === last.id);
  const homeBiz = next?.businessId ?? last?.businessId ?? me.businessIds[0];
  const loyalty = homeBiz ? loyaltyProgress(state, me.id, homeBiz) : null;
  const rhythm = visitRhythm(state, me.id, now);
  const offers = state.waitlist.filter((w) => w.customerId === me.id && w.status === "oferta_enviada");
  const available = state.rewards.filter((r) => r.customerId === me.id && r.status === "disponible");
  const preferred = state.staff.find((s) => s.id === me.preferredStaffId);
  const withPreferred = preferred ? sessions.filter((s) => s.staffId === preferred.id).length : 0;
  const heroPhoto = lastEntry?.coverPhotoId ? state.photos.find((p) => p.id === lastEntry.coverPhotoId) : undefined;
  const looks = state.styleEntries
    .filter((e) => e.customerId === me.id && e.coverPhotoId)
    .map((e) => ({ e, s: state.sessions.find((x) => x.id === e.sessionId)! }))
    .sort((a, b) => b.s.completedAt.localeCompare(a.s.completedAt))
    .slice(0, 8);
  const alerts = offers.length + available.length;
  const isToday = next ? datePart(next.start) === datePart(now) : false;
  const staff = next ? state.staff.find((s) => s.id === next.staffId) : undefined;
  const action = next ? nextAction(next, isToday) : null;

  const quick: { icon: IconName; label: string; to: string }[] = [
    { icon: "calendar", label: "Reservar", to: "/cliente/reservar" },
    { icon: "heart", label: "Preparar mi visita", to: next ? `/cliente/preparar/${next.id}` : "/cliente/reservar" },
    { icon: "repeat", label: "Repetir último look", to: lastEntry ? `/cliente/reservar?repetir=${lastEntry.id}` : "/cliente/reservar" },
    { icon: "history", label: "Historial", to: "/cliente/citas?tab=pasadas" },
  ];

  return (
    <div className={`page ${firstVisit ? "stagger" : ""}`}>
      <section className="home-hero" aria-label="Inicio">
        <div className="parallax" ref={heroRef}>
          <PhotoArt hue={heroPhoto?.hue ?? me.hue} view="lateral_der" img={me.photo ?? heroPhoto?.img} />
        </div>
        <div className="hello">
          <div className="who">
            Hola,
            <b>{me.name.split(" ")[0]}</b>
          </div>
          <button
            className="glass-round"
            aria-label={alerts ? `Avisos: ${alerts}` : "Avisos"}
            style={{ position: "relative" }}
            onClick={() => navigate(offers.length ? "/cliente/espera" : "/cliente/recompensas")}
          >
            <Icon name="bell" />
            {alerts > 0 && (
              <span style={{ position: "absolute", top: 9, right: 10, width: 9, height: 9, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 0 2px rgba(0,0,0,.4)" }} />
            )}
          </button>
        </div>

        <p className="claim">Tu estilo. Siempre contigo.</p>

        {next && action ? (
          <div className="stack" style={{ gap: 8 }}>
            <button className="next-card dark-glass" onClick={() => navigate(`/cliente/cita/${next.id}`)} aria-label="Tu próxima cita">
              <span className="cal">
                <Icon name="calendar" size={22} />
              </span>
              <span className="grow stack tight" style={{ minWidth: 0 }}>
                <span className="xs" style={{ opacity: 0.75 }}>
                  Tu próxima cita · {STATE_LABEL[next.status]}
                </span>
                <b style={{ fontSize: "var(--fs-lg)" }}>
                  {capitalize(formatRelativeDay(next.start, now))} · {timePart(next.start)}
                </b>
                <span className="xs" style={{ opacity: 0.75 }}>
                  {next.services.map((s) => s.name).join(" + ")} con {staff?.name}
                </span>
              </span>
              <span className="arrow" aria-hidden="true">
                <Icon name="arrowRight" size={18} strokeWidth={2.2} />
              </span>
            </button>
            <button className="glass-pill" style={{ alignSelf: "flex-start", background: "rgba(255,255,255,.94)", color: "#0b0b0c" }} onClick={() => navigate(action.to)}>
              <Icon name={action.icon} size={16} /> {action.label}
            </button>
          </div>
        ) : (
          <button className="next-card dark-glass" onClick={() => navigate("/cliente/reservar")}>
            <span className="cal">
              <Icon name="plus" size={22} />
            </span>
            <span className="grow">
              <span className="xs" style={{ opacity: 0.75 }}>
                Sin citas próximas
              </span>
              <b style={{ display: "block", fontSize: "var(--fs-lg)" }}>Reserva tu próxima visita</b>
            </span>
            <span className="arrow" aria-hidden="true">
              <Icon name="arrowRight" size={18} strokeWidth={2.2} />
            </span>
          </button>
        )}

        <nav className="quick" aria-label="Accesos rápidos">
          {quick.map((q) => (
            <button key={q.label} className="dark-glass" onClick={() => navigate(q.to)}>
              <Icon name={q.icon} size={20} />
              {q.label}
            </button>
          ))}
        </nav>
      </section>

      {offers.map((w) => (
        <Notice key={w.id} tone="warning" icon="bell">
          Se ha liberado un hueco que encaja con tu lista de espera.{" "}
          <a href="#/cliente/espera" style={{ fontWeight: 700 }}>
            Ver oferta
          </a>
        </Notice>
      ))}

      {looks.length > 0 && (
        <section className="section" aria-label="Últimos looks">
          <div className="section-title">
            Últimos looks
            <a href="#/cliente/looks" className="small muted" style={{ textDecoration: "none", fontWeight: 500 }}>
              Ver todo
            </a>
          </div>
          <div className="looks-row">
            {looks.map(({ e, s }) => {
              const p = state.photos.find((x) => x.id === e.coverPhotoId)!;
              return (
                <button key={e.id} className="look-mini" onClick={(ev) => navigate(`/cliente/visita/${s.id}`, ev.currentTarget.querySelector<HTMLElement>(".photo"))}>
                  <PhotoArt hue={p.hue} view={p.view} img={p.img} label={null} />
                  <span className="small" style={{ fontWeight: 650, lineHeight: 1.2 }}>
                    {e.title}
                  </span>
                  <span className="xs muted">{shortDate(s.completedAt)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <button className="ai-card" onClick={() => navigate("/cliente/style-ai")}>
        <span className="ai-orb" aria-hidden="true">
          <Icon name="sparkle" size={20} strokeWidth={2} />
        </span>
        <span className="grow">
          <span className="row" style={{ gap: 8 }}>
            <b>Style AI</b> <span className="soon">Próximamente</span>
          </span>
          <span className="xs" style={{ opacity: 0.75 }}>
            Prueba nuevos looks con IA
          </span>
        </span>
        <span className="arrow" aria-hidden="true">
          <Icon name="arrowRight" size={18} strokeWidth={2.2} />
        </span>
      </button>

      {loyalty && (
        <button className="progress-card" onClick={() => navigate("/cliente/recompensas")} aria-label="Tu progreso de recompensas">
          <div className="row between">
            <div>
              <div className="xs muted">Tu progreso</div>
              <div className="big">
                {loyalty.inCycle}/{loyalty.program.goal}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ color: "var(--loyalty)" }}>
                <Icon name="crown" size={22} />
              </span>
              <div>
                <div className="xs muted">{available.length ? "Recompensa disponible" : "Próxima recompensa"}</div>
                <b className="small">{loyalty.program.rewardName}</b>
              </div>
            </div>
          </div>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${(loyalty.inCycle / loyalty.program.goal) * 100}%` }} />
          </div>
        </button>
      )}

      {last && (
        <div className="facts" aria-label="Tu ritmo">
          <div className="fact">
            <b>{daysBetween(last.completedAt, now)} días</b>
            <span>desde tu último corte</span>
          </div>
          <div className="fact">
            <b>{withPreferred || sessions.length} visitas</b>
            <span>{preferred ? `con ${preferred.name}` : "en total"}</span>
          </div>
          <div className="fact">
            <b>{rhythm ? `~${rhythm.avgDays} días` : "—"}</b>
            <span>{rhythm ? "tu ritmo habitual" : "aún sin ritmo"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
