// Home del cliente: contexto, no un dashboard (apartado 43). Lenguaje visual R13: saludo con avatar,
// accesos por categoría y la próxima cita como tarjeta fotográfica con controles de cristal.

import { useState } from "react";
import { navigate } from "../../app/router";
import { useTilt } from "../../ui/motion";
import { useStore } from "../../app/store";
import { customerSessions, loyaltyProgress, upcomingAppointments, visitRhythm } from "../../domain/queries";
import { datePart, daysBetween, formatDay, formatRelativeDay, timePart } from "../../domain/time";
import type { Appointment, ServiceCategory } from "../../domain/types";
import { Icon, type IconName } from "../../ui/Icon";
import { Avatar, Empty, Notice, PhotoArt } from "../../ui/common";
import { LoyaltyBlock, capitalize } from "../../ui/product";

const CATEGORIES: { cat: ServiceCategory; label: string; icon: IconName; hue: number }[] = [
  { cat: "corte", label: "Corte", icon: "scissors", hue: 22 },
  { cat: "degradado", label: "Degradado", icon: "layers", hue: 205 },
  { cat: "barba", label: "Barba", icon: "beard", hue: 150 },
  { cat: "color", label: "Color", icon: "drop", hue: 330 },
  { cat: "trenzas", label: "Trenzas", icon: "wave", hue: 268 },
  { cat: "cejas", label: "Cejas", icon: "sparkle", hue: 42 },
  { cat: "tratamiento", label: "Tratamiento", icon: "heart", hue: 180 },
];

function NextAppointmentCard({ appt }: { appt: Appointment }) {
  const { state, now } = useStore();
  const staff = state.staff.find((s) => s.id === appt.staffId)!;
  const prep = state.preparations.find((p) => p.appointmentId === appt.id);
  const prepEntry = prep?.styleEntryId ? state.styleEntries.find((e) => e.id === prep.styleEntryId) : undefined;
  const photoId = prep?.referencePhotoId ?? prepEntry?.coverPhotoId;
  const photo = photoId ? state.photos.find((p) => p.id === photoId) : undefined;
  const customer = state.customers.find((c) => c.id === appt.customerId)!;
  const isToday = datePart(appt.start) === datePart(now);
  const arrived = appt.status === "llegada" || appt.status === "en_atencion";
  const tilt = useTilt<HTMLElement>(4);

  return (
    <article className="photo-card" aria-label="Próxima cita" ref={tilt}>
      <PhotoArt hue={photo?.hue ?? customer.hue} view={photo?.view ?? "lateral_der"} label={photo ? "Tu referencia · demo" : "Foto demo"} />
      <div className="top">
        <span className="chip-glass">
          <Icon name={arrived ? "check" : "clock"} size={14} strokeWidth={2.2} />
          {arrived ? "Llegada registrada" : appt.status === "modificada" ? "Modificada" : "Confirmada"}
        </span>
        <button className="glass-round" aria-label="Detalles de la reserva" onClick={() => navigate(`/cliente/cita/${appt.id}`)}>
          <Icon name="more" size={22} strokeWidth={3} />
        </button>
      </div>
      <div className="side">
        {!arrived && (
          <div>
            <button className="glass-round" aria-label="Mostrar QR" onClick={() => navigate(`/cliente/pase/${appt.id}`)}>
              <Icon name="qr" />
            </button>
            <div className="label">QR</div>
          </div>
        )}
        <div>
          <button className="glass-round" aria-label="Preparar visita" onClick={() => navigate(`/cliente/preparar/${appt.id}`)}>
            <Icon name="sparkle" />
          </button>
          <div className="label">Preparar</div>
        </div>
        <div>
          <button className="glass-round" aria-label="Ver reserva" onClick={() => navigate(`/cliente/cita/${appt.id}`)}>
            <Icon name="calendar" />
          </button>
          <div className="label">Reserva</div>
        </div>
      </div>
      <div className="pc-bottom">
        <span className="small" style={{ opacity: 0.85, fontWeight: 600 }}>
          Próxima cita
        </span>
        <span className="when">
          {capitalize(formatRelativeDay(appt.start, now))} · {timePart(appt.start)}
        </span>
        <span style={{ fontWeight: 600 }}>
          {appt.services.map((s) => s.name).join(" + ")} con {staff.name}
        </span>
        <div className="row wrap" style={{ gap: 6 }}>
          {prep ? (
            <span className="chip-glass">
              <Icon name="sparkle" size={12} /> {prepEntry ? `Repetir «${prepEntry.title}»` : "Visita preparada"}
            </span>
          ) : (
            <span className="chip-glass">Sin preparar</span>
          )}
          {isToday && !arrived && <span className="chip-glass">Muestra el QR al llegar</span>}
        </div>
      </div>
    </article>
  );
}

export function Home() {
  const { state, actor, now } = useStore();
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
  const cover = lastEntry?.coverPhotoId ? state.photos.find((p) => p.id === lastEntry.coverPhotoId) : undefined;
  const homeBiz = next?.businessId ?? last?.businessId ?? me.businessIds[0];
  const loyalty = homeBiz ? loyaltyProgress(state, me.id, homeBiz) : null;
  const rhythm = visitRhythm(state, me.id, now);
  const offers = state.waitlist.filter((w) => w.customerId === me.id && w.status === "oferta_enviada");
  const available = state.rewards.filter((r) => r.customerId === me.id && r.status === "disponible");
  const preferred = state.staff.find((s) => s.id === me.preferredStaffId);
  const withPreferred = preferred ? sessions.filter((s) => s.staffId === preferred.id).length : 0;
  const hour = Number(now.slice(11, 13));
  const greeting = hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";
  const categories = CATEGORIES.map((c) => ({ ...c, service: state.services.find((s) => s.businessId === homeBiz && s.active && s.category === c.cat) })).filter((c) => c.service);

  return (
    <div className={`page ${firstVisit ? "stagger" : ""}`}>
      <header className="home-head">
        <button style={{ all: "unset", cursor: "pointer" }} onClick={() => navigate("/cliente/perfil")} aria-label="Ir a tu perfil">
          <Avatar name={me.name} hue={me.hue} />
        </button>
        <div className="grow">
          <div className="small muted">{greeting}</div>
          <h1 style={{ fontSize: "var(--fs-xl)", fontWeight: 750, letterSpacing: "-0.02em" }}>{me.name}</h1>
        </div>
        <a className="glass-pill" href="#/cliente/recompensas" aria-label="Recompensas">
          <Icon name="gift" size={16} /> {available.length > 0 ? available.length : loyalty ? `${loyalty.inCycle}/${loyalty.program.goal}` : ""}
        </a>
        <a className="glass-pill icon" href="#/cliente/espera" aria-label="Avisos y lista de espera" style={{ position: "relative" }}>
          <Icon name="bell" size={18} />
          {offers.length > 0 && (
            <span style={{ position: "absolute", top: 7, right: 9, width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
          )}
        </a>
      </header>

      <nav className="cat-row" aria-label="Reservar por servicio">
        {categories.map((c) => (
          <button key={c.cat} className="cat" style={{ ["--h" as string]: c.hue }} onClick={() => navigate(`/cliente/reservar?servicios=${c.service!.id}`)}>
            <span className="tile">
              <Icon name={c.icon} size={24} strokeWidth={2} />
            </span>
            {c.label}
          </button>
        ))}
      </nav>

      {offers.map((w) => (
        <Notice key={w.id} tone="warning" icon="bell">
          Se ha liberado un hueco que encaja con tu lista de espera.{" "}
          <a href="#/cliente/espera" style={{ fontWeight: 700 }}>
            Ver oferta
          </a>
        </Notice>
      ))}

      {next ? (
        <NextAppointmentCard appt={next} />
      ) : (
        <Empty
          icon="calendar"
          title="No tienes citas próximas"
          action={
            <button className="btn primary" onClick={() => navigate("/cliente/reservar")}>
              Reservar
            </button>
          }
        >
          {last ? "Cuando quieras, puedes repetir tu último estilo o probar algo nuevo." : "Reserva tu primera visita y aquí aparecerá todo lo que necesitas."}
        </Empty>
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

      {loyalty && (
        <button style={{ all: "unset", cursor: "pointer", display: "block" }} onClick={() => navigate("/cliente/recompensas")} aria-label="Ver recompensas">
          <LoyaltyBlock inCycle={loyalty.inCycle} goal={loyalty.program.goal} rewardName={loyalty.program.rewardName} />
        </button>
      )}
      {available.length > 0 && (
        <Notice tone="success" icon="gift">
          Tienes {available.length === 1 ? "una recompensa disponible" : `${available.length} recompensas disponibles`}.{" "}
          <a href="#/cliente/recompensas" style={{ fontWeight: 700 }}>
            Ver
          </a>
        </Notice>
      )}

      {last && lastEntry && (
        <section className="section" aria-label="Tu último estilo">
          <div className="section-title">Tu último estilo</div>
          <article className="card row" style={{ padding: "var(--s3)" }}>
            {cover ? (
              <PhotoArt hue={cover.hue} view={cover.view} label={null} style={{ width: 88, height: 110, borderRadius: 16, flexShrink: 0 }} />
            ) : (
              <span className="photo" style={{ width: 88, height: 110, borderRadius: 16, flexShrink: 0 }} />
            )}
            <div className="grow stack" style={{ gap: 8 }}>
              <div>
                <b>{lastEntry.title}</b>
                <div className="xs muted">
                  {formatDay(last.completedAt)} · {state.staff.find((s) => s.id === last.staffId)?.name}
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn primary sm" onClick={() => navigate(`/cliente/reservar?repetir=${lastEntry.id}`)}>
                  <Icon name="repeat" size={16} /> Repetir
                </button>
                <button className="btn outline sm" onClick={() => navigate(`/cliente/visita/${last.id}`)}>
                  Detalles
                </button>
              </div>
            </div>
          </article>
        </section>
      )}

      {!last && !next && (
        <Notice icon="camera">
          Después de tu primera visita, tu barbero podrá añadir fotos del resultado. Solo tú las verás salvo que autorices otra cosa.
        </Notice>
      )}
    </div>
  );
}
