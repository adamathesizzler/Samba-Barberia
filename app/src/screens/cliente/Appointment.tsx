// Confirmación / detalle de cita (apartados 11, 12, 14) y pase con QR (13, 41).

import { useState } from "react";
import { navigate, parseHash } from "../../app/router";
import { useStore } from "../../app/store";
import { freeSlots, totalDuration } from "../../domain/availability";
import { datePart, formatDay, timePart } from "../../domain/time";
import type { Appointment } from "../../domain/types";
import { Icon } from "../../ui/Icon";
import { Empty, Notice, PageHeader, Sheet, SimBadge } from "../../ui/common";
import { CheckInQR, Ticket, capitalize } from "../../ui/product";

function icsFor(a: Appointment, place: string, title: string) {
  const f = (s: string) => s.replace(/[-:]/g, "") + "00";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Samba prototipo//ES",
    "BEGIN:VEVENT",
    `UID:${a.id}@samba-demo`,
    `DTSTART:${f(a.start)}`,
    `DTEND:${f(a.end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${place}`,
    `DESCRIPTION:Reserva #${a.code}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function useOwnAppointment(id: string) {
  const { state, actor } = useStore();
  const a = state.appointments.find((x) => x.id === id);
  // Un identificador de otra reserva no muestra sus datos.
  if (!a || actor.kind !== "cliente" || a.customerId !== actor.customerId) return null;
  return a;
}

export function AppointmentDetail({ id }: { id: string }) {
  const { state, actor, be, now, toast } = useStore();
  const a = useOwnAppointment(id);
  const [sheet, setSheet] = useState<null | "gestionar" | "wallet" | "cambiar" | "calendario">(null);
  const [newTime, setNewTime] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isNew = parseHash().query.get("nueva") === "1";

  if (!a)
    return (
      <div className="page">
        <PageHeader title="Reserva" backTo="/cliente/inicio" />
        <Empty icon="lock" title="No encontramos esta reserva">
          Puede que el enlace no sea tuyo o que la reserva ya no exista.
        </Empty>
      </div>
    );

  const staff = state.staff.find((s) => s.id === a.staffId)!;
  const loc = state.locations.find((l) => l.id === a.locationId)!;
  const prep = state.preparations.find((p) => p.appointmentId === a.id);
  const checkIn = state.checkIns.find((c) => c.appointmentId === a.id);
  const session = state.sessions.find((s) => s.appointmentId === a.id);
  const pending = a.status === "confirmada" || a.status === "modificada";
  const isToday = datePart(a.start) === datePart(now);
  const title = `${a.services.map((s) => s.name).join(" + ")} con ${staff.name}`;
  const waitReq = state.waitlist.find((w) => w.originalAppointmentId === a.id && ["activa", "oferta_enviada"].includes(w.status));

  const ics = icsFor(a, `${loc.name}, ${loc.address}`, title);
  const copyIcs = async () => {
    try {
      await navigator.clipboard.writeText(ics);
      toast("Evento copiado");
    } catch {
      toast("No se pudo copiar; selecciona el texto");
    }
  };

  return (
    <div className="page">
      <PageHeader title={isNew ? "¡Listo!" : "Tu reserva"} backTo="/cliente/inicio" />

      <Ticket appt={a}>
        {pending && (
          <div className="grid-2">
            <button className="btn primary" onClick={() => navigate(isToday ? `/cliente/pase/${a.id}` : `/cliente/preparar/${a.id}`)}>
              <Icon name={isToday ? "qr" : "sparkle"} size={18} /> {isToday ? "Mostrar QR" : prep ? "Preparación" : "Preparar visita"}
            </button>
            <button className="btn outline" onClick={() => navigate(`/cliente/pase/${a.id}`)}>
              <Icon name="qr" size={18} /> Pase
            </button>
            <button className="btn outline" onClick={() => setSheet("wallet")}>
              <Icon name="wallet" size={18} /> Wallet
            </button>
            <button className="btn outline" onClick={() => setSheet("calendario")}>
              <Icon name="calendar" size={18} /> Calendario
            </button>
          </div>
        )}
      </Ticket>

      {a.finishBy && pending && <Notice icon="clock">Pediste terminar antes de las {a.finishBy}. Pendiente de confirmar por el local.</Notice>}

      {(a.status === "llegada" || a.status === "en_atencion") && (
        <Notice tone="success" icon="check">
          Llegada registrada a las {checkIn ? timePart(checkIn.at) : "—"}. {a.status === "en_atencion" ? `Estás en atención con ${staff.name}.` : `${staff.name} te atenderá enseguida.`}
        </Notice>
      )}

      {session && (
        <button className="btn primary block" onClick={() => navigate(`/cliente/visita/${session.id}`)}>
          Ver resultado de la visita
        </button>
      )}

      {a.status === "cancelada" && (
        <button className="btn primary block" onClick={() => navigate(`/cliente/reservar?servicios=${a.services.map((s) => s.serviceId).join(",")}&profesional=${a.staffId}`)}>
          Reservar de nuevo
        </button>
      )}

      {pending && prep && (
        <section className="card stack">
          <div className="row between">
            <b>Tu preparación</b>
            <a href={`#/cliente/preparar/${a.id}`} className="small">
              Editar
            </a>
          </div>
          {prep.keep && <p className="small">Mantener: {prep.keep}</p>}
          {prep.change && <p className="small">Cambiar: {prep.change}</p>}
          {!prep.keep && !prep.change && <p className="small muted">Referencia guardada, sin indicaciones escritas.</p>}
        </section>
      )}

      {pending && (
        <div className="list">
          <button className="list-item" onClick={() => setSheet("cambiar")}>
            <Icon name="calendar" /> <span className="grow">Cambiar la hora</span> <Icon name="chevronRight" />
          </button>
          <button
            className="list-item"
            disabled={!!waitReq}
            onClick={() => {
              const r = be.joinWaitlist(actor, {
                customerId: a.customerId,
                businessId: a.businessId,
                serviceIds: a.services.map((s) => s.serviceId),
                staffIds: [a.staffId],
                date: datePart(now),
                timeFrom: "09:00",
                timeTo: "20:00",
                originalAppointmentId: a.id,
              });
              if (r.ok) toast("Te avisaremos si se libera un hueco antes. Tu cita sigue igual.");
            }}
          >
            <Icon name="bell" />
            <span className="grow">
              {waitReq ? "En lista de espera para un hueco antes" : "Avísame si se libera algo antes"}
              <div className="xs muted">Tu cita actual no cambia hasta que aceptes otra.</div>
            </span>
          </button>
          <button className="list-item" onClick={() => setSheet("gestionar")} style={{ color: "var(--danger)" }}>
            <Icon name="x" /> <span className="grow">Cancelar reserva</span>
          </button>
        </div>
      )}

      <details className="card flat small">
        <summary>Historial de la reserva</summary>
        <ul className="xs muted">
          {a.history.map((h, i) => (
            <li key={i}>
              {h.at.replace("T", " ")} · {h.status} · {h.by}
              {h.note ? ` · ${h.note}` : ""}
            </li>
          ))}
        </ul>
      </details>

      {sheet === "wallet" && (
        <Sheet title="Añadir a Wallet" onClose={() => setSheet(null)}>
          <SimBadge>Integración pendiente · Fase 2</SimBadge>
          <p className="small">
            Todavía no se genera un pase real de Apple Wallet ni de Google Wallet, así que no lo añadimos. Mientras tanto, tu QR está siempre disponible en esta app.
          </p>
          <button
            className="btn primary block"
            onClick={() => {
              setSheet(null);
              navigate(`/cliente/pase/${a.id}`);
            }}
          >
            Abrir mi pase en la app
          </button>
        </Sheet>
      )}

      {sheet === "calendario" && (
        <Sheet title="Añadir al calendario" onClose={() => setSheet(null)}>
          <p className="small">
            {capitalize(formatDay(a.start))}, de {timePart(a.start)} a {timePart(a.end)} · {title} · {loc.name}
          </p>
          <p className="xs muted">En la app instalada se descargará un archivo .ics. En esta vista previa puedes copiar el evento.</p>
          <textarea className="textarea code xs" readOnly value={ics} rows={6} aria-label="Evento de calendario" onFocus={(e) => e.currentTarget.select()} />
          <button className="btn primary block" onClick={copyIcs}>
            Copiar evento
          </button>
        </Sheet>
      )}

      {sheet === "gestionar" && (
        <Sheet title="¿Cancelar la reserva?" onClose={() => setSheet(null)}>
          <p className="small">
            {capitalize(formatDay(a.start))} a las {timePart(a.start)} con {staff.name}. Las condiciones de cancelación están pendientes de definir con el negocio.
          </p>
          <button
            className="btn danger block"
            onClick={() => {
              const r = be.cancel(actor, a.id);
              setSheet(null);
              toast(r.ok ? "Reserva cancelada" : r.message);
            }}
          >
            Sí, cancelar
          </button>
          <button className="btn outline block" onClick={() => setSheet(null)}>
            Mantener reserva
          </button>
        </Sheet>
      )}

      {sheet === "cambiar" && (
        <Sheet title="Cambiar la hora" onClose={() => setSheet(null)}>
          <p className="small muted">
            {capitalize(formatDay(a.start))} · {staff.name}. Mismos servicios y precio de tu reserva.
          </p>
          {err && <Notice tone="danger">{err}</Notice>}
          <div className="times">
            {freeSlots(state, a.staffId, datePart(a.start), totalDuration(a.services), now)
              .filter((t) => t !== a.start)
              .map((t) => (
                <button key={t} className="chip" role="radio" aria-checked={newTime === t} onClick={() => setNewTime(t)}>
                  {timePart(t)}
                </button>
              ))}
          </div>
          <button
            className="btn primary block"
            disabled={!newTime}
            onClick={() => {
              const r = be.reschedule(actor, a.id, newTime!);
              if (!r.ok) setErr(r.message);
              else {
                setSheet(null);
                toast("Hora cambiada");
              }
            }}
          >
            Confirmar cambio
          </button>
        </Sheet>
      )}
    </div>
  );
}

export function Pass({ id }: { id: string }) {
  const { state } = useStore();
  const a = useOwnAppointment(id);
  if (!a)
    return (
      <div className="page">
        <PageHeader title="Pase" backTo="/cliente/inicio" />
        <Empty icon="lock" title="No encontramos este pase" />
      </div>
    );
  const staff = state.staff.find((s) => s.id === a.staffId)!;
  const valid = a.status === "confirmada" || a.status === "modificada";
  return (
    <div className="page">
      <PageHeader title="Tu pase" backTo={`/cliente/cita/${a.id}`} />
      <div className="card stack" style={{ alignItems: "center", textAlign: "center" }}>
        <b style={{ fontSize: "var(--fs-lg)" }}>
          {capitalize(formatDay(a.start))} · {timePart(a.start)}
        </b>
        <span className="muted small">
          {a.services.map((s) => s.name).join(" + ")} · {staff.name}
        </span>
        {valid ? (
          <>
            <CheckInQR token={a.qrToken} />
            <span className="small">Muéstralo al llegar. Solo el personal del local puede escanearlo.</span>
          </>
        ) : a.status === "cancelada" ? (
          <Notice tone="danger" icon="x">
            Esta reserva está cancelada: el QR ya no es válido.
          </Notice>
        ) : (
          <Notice tone="success" icon="check">
            Llegada ya registrada. No necesitas volver a mostrar el QR.
          </Notice>
        )}
        <div className="card tinted" style={{ width: "100%" }}>
          <div className="xs muted">Si el QR no funciona, di este código en recepción</div>
          <b className="code" style={{ fontSize: "var(--fs-xl)" }}>
            #{a.code}
          </b>
        </div>
      </div>
      <p className="xs muted" style={{ textAlign: "center" }}>
        El código solo identifica la reserva. No contiene tus fotos, gastos ni datos personales.
      </p>
    </div>
  );
}
