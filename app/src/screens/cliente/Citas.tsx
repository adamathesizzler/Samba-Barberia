// Citas (pestaña del diseño v1.0): próximas y pasadas en un mismo sitio. Las pasadas abren
// el detalle de la visita (fotos, importe, mantenimiento, Antes/Después, repetir).

import { useState } from "react";
import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { customerSessions, upcomingAppointments } from "../../domain/queries";
import { formatRelativeDay, parseLocal, timePart } from "../../domain/time";
import { Icon } from "../../ui/Icon";
import { Empty, PageHeader, Segmented, StatusBadge } from "../../ui/common";
import { VisitRow, capitalize } from "../../ui/product";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function Citas({ tab: initialTab }: { tab: string | null }) {
  const { state, actor, now } = useStore();
  const [tab, setTab] = useState<"proximas" | "pasadas">(initialTab === "pasadas" ? "pasadas" : "proximas");
  const [cat, setCat] = useState("todo");
  if (actor.kind !== "cliente") return null;
  const upcoming = upcomingAppointments(state, actor.customerId, now);
  const cancelled = state.appointments
    .filter((a) => a.customerId === actor.customerId && a.status === "cancelada" && a.start > now)
    .sort((a, b) => a.start.localeCompare(b.start));
  const waiting = state.waitlist.filter((w) => w.customerId === actor.customerId && ["activa", "oferta_enviada"].includes(w.status));
  const sessions = customerSessions(state, actor.customerId).filter(
    (s) => cat === "todo" || s.services.some((l) => state.services.find((x) => x.id === l.serviceId)?.category === cat),
  );

  return (
    <div className="page">
      <PageHeader
        title="Citas"
        action={
          <button className="icon-btn" aria-label="Nueva reserva" onClick={() => navigate("/cliente/reservar")}>
            <Icon name="plus" />
          </button>
        }
      />
      <Segmented
        label="Citas"
        value={tab}
        onChange={(t) => {
          setTab(t);
          history.replaceState(null, "", `#/cliente/citas?tab=${t}`);
        }}
        options={[
          { key: "proximas", label: `Próximas${upcoming.length ? ` · ${upcoming.length}` : ""}` },
          { key: "pasadas", label: "Pasadas" },
        ]}
      />

      {tab === "proximas" ? (
        <>
          {upcoming.length === 0 && (
            <Empty
              icon="calendar"
              title="No tienes citas próximas"
              action={
                <button className="btn primary" onClick={() => navigate("/cliente/reservar")}>
                  Reservar
                </button>
              }
            />
          )}
          {[...upcoming, ...cancelled].map((a) => {
            const p = parseLocal(a.start);
            const staff = state.staff.find((s) => s.id === a.staffId);
            return (
              <button key={a.id} className="appt-mini" onClick={() => navigate(`/cliente/cita/${a.id}`)} style={a.status === "cancelada" ? { opacity: 0.6 } : undefined}>
                <span className="date-chip" aria-pressed={a.status !== "cancelada"}>
                  <span>{DAYS[p.getDay()]}</span>
                  <b>{p.getDate()}</b>
                  <span>{MONTHS[p.getMonth()]}</span>
                </span>
                <span className="grow stack tight" style={{ minWidth: 0 }}>
                  <b>
                    {capitalize(formatRelativeDay(a.start, now))} · {timePart(a.start)}
                  </b>
                  <span className="small muted">
                    {a.services.map((s) => s.name).join(" + ")} · {staff?.name}
                  </span>
                  <span>
                    <StatusBadge status={a.status} />
                  </span>
                </span>
                <Icon name="chevronRight" />
              </button>
            );
          })}
          {waiting.length > 0 && (
            <a className="card row" href="#/cliente/espera" style={{ textDecoration: "none", color: "inherit" }}>
              <Icon name="bell" />
              <span className="grow small">
                {waiting.some((w) => w.status === "oferta_enviada") ? "Tienes una oferta de hueco en tu lista de espera" : `En lista de espera (${waiting.length})`}
              </span>
              <Icon name="chevronRight" />
            </a>
          )}
        </>
      ) : (
        <>
          <div className="chips" role="group" aria-label="Filtrar por servicio">
            {[
              ["todo", "Todo"],
              ["degradado", "Degradado"],
              ["corte", "Corte"],
              ["barba", "Barba"],
              ["color", "Tinte"],
            ].map(([k, l]) => (
              <button key={k} className="chip" aria-pressed={cat === k} onClick={() => setCat(k)}>
                {l}
              </button>
            ))}
          </div>
          {sessions.length === 0 ? (
            <Empty icon="history" title="Aún no hay visitas">
              Cuando termines una visita aparecerá aquí, con o sin fotos.
            </Empty>
          ) : (
            <div className="list">
              {sessions.map((s) => (
                <VisitRow key={s.id} session={s} onClick={() => navigate(`/cliente/visita/${s.id}`)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
