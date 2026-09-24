// Home del cliente: contexto, no un dashboard (apartado 43).

import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { customerSessions, loyaltyProgress, upcomingAppointments, visitRhythm } from "../../domain/queries";
import { formatDay } from "../../domain/time";
import { Icon } from "../../ui/Icon";
import { Empty, Notice, PhotoArt } from "../../ui/common";
import { AppointmentCard, LoyaltyBlock } from "../../ui/product";

export function Home() {
  const { state, actor, now } = useStore();
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
  const hour = Number(now.slice(11, 13));
  const greeting = hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="page">
      <header className="stack tight" style={{ paddingTop: "var(--s2)" }}>
        <span className="muted small">{greeting}</span>
        <h1 className="title-xl">{me.name.split(" ")[0]}</h1>
      </header>

      {offers.map((w) => (
        <Notice key={w.id} tone="warning" icon="bell">
          Se ha liberado un hueco que encaja con tu lista de espera.{" "}
          <a href="#/cliente/espera" style={{ fontWeight: 700 }}>
            Ver oferta
          </a>
        </Notice>
      ))}

      {next ? (
        <AppointmentCard appt={next} />
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

      {last && lastEntry ? (
        <section className="section" aria-label="Tu último estilo">
          <div className="section-title">Tu último estilo</div>
          <article className="card flat" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ position: "relative" }}>
              {cover ? (
                <PhotoArt hue={cover.hue} view={cover.view} style={{ aspectRatio: "4 / 3" }} />
              ) : (
                <div className="photo" style={{ aspectRatio: "4 / 3", display: "grid", placeItems: "center", color: "var(--text-3)" }}>
                  <span className="small">Visita sin fotos</span>
                </div>
              )}
            </div>
            <div className="stack" style={{ padding: "var(--s4)" }}>
              <div>
                <b>{lastEntry.title}</b>
                <div className="small muted">
                  {formatDay(last.completedAt)} · {state.staff.find((s) => s.id === last.staffId)?.name}
                </div>
              </div>
              <div className="row">
                <button className="btn primary grow" onClick={() => navigate(`/cliente/reservar?repetir=${lastEntry.id}`)}>
                  <Icon name="repeat" size={18} /> Repetir
                </button>
                <button className="btn outline grow" onClick={() => navigate(`/cliente/visita/${last.id}`)}>
                  Ver detalles
                </button>
              </div>
            </div>
          </article>
        </section>
      ) : (
        !next && (
          <Notice icon="camera">
            Después de tu primera visita, tu barbero podrá añadir fotos del resultado. Solo tú las verás salvo que autorices otra cosa.
          </Notice>
        )
      )}

      {rhythm && !next && (
        <Notice icon="clock">
          Sueles volver aproximadamente cada {rhythm.avgDays} días (según tus últimas {rhythm.basedOn} visitas). Tu última visita fue hace {rhythm.daysSinceLast} días.
        </Notice>
      )}
    </div>
  );
}
