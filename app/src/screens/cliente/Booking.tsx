// Reserva: servicios → profesional → fecha y hora → preferencias → revisión (apartados 9, 10, 28).

import { useMemo, useState } from "react";
import { back, navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { freeSlots, priceServicesFor, staffForServices, totalDuration, totalPrice } from "../../domain/availability";
import { addDays, datePart, formatDay, formatMoney, parseLocal, timePart, weekday } from "../../domain/time";
import { Icon } from "../../ui/Icon";
import { Avatar, Notice, PhotoArt } from "../../ui/common";
import { capitalize } from "../../ui/product";

const STEPS = ["Servicios", "Profesional", "Fecha y hora", "Preferencias", "Revisión"];

export function Booking({ query }: { query: URLSearchParams }) {
  const { state, actor, now, be, toast } = useStore();
  const me = actor.kind === "cliente" ? state.customers.find((c) => c.id === actor.customerId)! : null;
  const repeatEntry = state.styleEntries.find((e) => e.id === query.get("repetir") && e.customerId === me?.id);
  const repeatSession = repeatEntry && state.sessions.find((s) => s.id === repeatEntry.sessionId);
  const businessId = repeatSession?.businessId ?? me?.businessIds[0] ?? state.businesses[0].id;
  const location = state.locations.find((l) => l.businessId === businessId)!;
  const refPhoto = state.photos.find((p) => p.id === query.get("ref"));

  const initialServices = repeatSession
    ? repeatSession.services.map((l) => l.serviceId).filter((id) => state.services.some((s) => s.id === id && s.active))
    : (query.get("servicios")?.split(",").filter(Boolean) ?? []);
  const initialStaff = query.get("profesional") ?? (repeatSession?.staffId || me?.preferredStaffId || "");

  const [step, setStep] = useState(initialServices.length ? (initialStaff ? 2 : 1) : 0);
  const [serviceIds, setServiceIds] = useState<string[]>(initialServices);
  const [staffId, setStaffId] = useState(initialStaff);
  const [date, setDate] = useState(datePart(now));
  const [time, setTime] = useState<string | null>(null);
  const [finishBy, setFinishBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitFrom, setWaitFrom] = useState("09:00");
  const [waitTo, setWaitTo] = useState("20:00");

  const services = state.services.filter((s) => s.businessId === businessId && s.active);
  const capable = staffForServices(state, businessId, serviceIds);
  const staff = capable.find((s) => s.id === staffId);
  const lines = staff ? priceServicesFor(state, staff.id, serviceIds) : null;
  const duration = lines ? totalDuration(lines) : 0;
  const days = useMemo(() => {
    const out: string[] = [];
    let d = datePart(now) + "T00:00";
    while (out.length < 14) {
      if (weekday(d) !== 0) out.push(datePart(d));
      d = addDays(d, 1);
    }
    return out;
  }, [now]);
  const slots = staff && duration ? freeSlots(state, staff.id, date, duration, now) : [];

  if (!me) return null;

  const toggle = (id: string) => setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const confirm = () => {
    if (!staff || !time || busy) return;
    setBusy(true);
    const r = be.book(actor, {
      businessId,
      locationId: location.id,
      customerId: me.id,
      staffId: staff.id,
      serviceIds,
      start: `${date}T${time}`,
      source: "app",
      finishBy: finishBy || undefined,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      setTime(null);
      setStep(2);
      return;
    }
    if (repeatEntry)
      be.savePreparation(actor, r.appointment.id, {
        mode: "elegir_anterior",
        styleEntryId: repeatEntry.id,
        keep: "",
        change: "",
        note: "",
      });
    else if (refPhoto)
      be.savePreparation(actor, r.appointment.id, { mode: "subir_referencia", referencePhotoId: refPhoto.id, keep: "", change: "", note: "Referencia elegida en Explorar." });
    navigate(`/cliente/cita/${r.appointment.id}?nueva=1`);
  };

  const joinWaitlist = () => {
    const r = be.joinWaitlist(actor, {
      customerId: me.id,
      businessId,
      serviceIds,
      staffIds: staff ? [staff.id] : [],
      date,
      timeFrom: waitFrom,
      timeTo: waitTo,
    });
    if (r.ok) {
      toast("Te avisaremos si se libera un hueco compatible");
      navigate("/cliente/espera");
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" aria-label={step === 0 ? "Salir de la reserva" : "Paso anterior"} onClick={() => (step === 0 ? back("/cliente/inicio") : setStep(step - 1))}>
          <Icon name={step === 0 ? "x" : "chevronLeft"} />
        </button>
        <div className="grow">
          <div className="xs muted">
            Paso {step + 1} de {STEPS.length}
          </div>
          <h1 style={{ fontSize: "var(--fs-xl)", fontWeight: 700 }}>{STEPS[step]}</h1>
        </div>
      </header>
      <div className="progress" aria-hidden>
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: "var(--selected)" }} />
      </div>

      {repeatEntry && (
        <Notice icon="repeat">
          Repites «{repeatEntry.title}». Se usan el precio y la disponibilidad actuales; tu barbero confirmará la adaptación.
        </Notice>
      )}
      {refPhoto && (
        <div className="row card tinted">
          <PhotoArt hue={refPhoto.hue} view={refPhoto.view} label={null} style={{ width: 48, height: 60, borderRadius: 10 }} />
          <span className="small">La referencia elegida se añadirá a la preparación de tu visita.</span>
        </div>
      )}

      {step === 0 && (
        <div className="stack">
          <div className="list">
            {services.map((s) => {
              const on = serviceIds.includes(s.id);
              return (
                <button key={s.id} className="list-item" role="checkbox" aria-checked={on} onClick={() => toggle(s.id)}>
                  <span
                    className="icon-btn"
                    style={{ width: 28, height: 28, background: on ? "var(--selected)" : "var(--surface-2)", color: "var(--on-selected)" }}
                    aria-hidden
                  >
                    {on && <Icon name="check" size={16} strokeWidth={2.6} />}
                  </span>
                  <span className="grow">
                    <b>{s.name}</b>
                    <div className="xs muted">{s.durationMin} min aprox.</div>
                  </span>
                  <b className="small">
                    {s.priceKind === "desde" ? "desde " : ""}
                    {formatMoney(s.priceCents)}
                  </b>
                </button>
              );
            })}
          </div>
          <button className="btn primary block" disabled={!serviceIds.length} onClick={() => setStep(1)}>
            Continuar
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          {capable.length === 0 ? (
            <Notice tone="warning">Ningún profesional realiza todos esos servicios juntos. Prueba a reservarlos por separado.</Notice>
          ) : (
            <div className="list">
              {capable.map((s) => {
                const l = priceServicesFor(state, s.id, serviceIds)!;
                return (
                  <button
                    key={s.id}
                    className="list-item"
                    aria-pressed={staffId === s.id}
                    style={staffId === s.id ? { background: "var(--surface-2)" } : undefined}
                    onClick={() => {
                      setStaffId(s.id);
                      setTime(null);
                      setStep(2);
                    }}
                  >
                    <Avatar name={s.name} hue={s.hue} />
                    <span className="grow">
                      <b>{s.name}</b> {s.id === me.preferredStaffId && <span className="badge">Habitual</span>}
                      <div className="xs muted">{s.specialties.join(" · ")}</div>
                    </span>
                    <span className="xs muted" style={{ textAlign: "right" }}>
                      {totalDuration(l)} min
                      <br />
                      {formatMoney(totalPrice(l))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === 2 && staff && (
        <div className="stack">
          {error && (
            <Notice tone="danger" icon="alert">
              {error}
            </Notice>
          )}
          <div className="days" role="group" aria-label="Día">
            {days.map((d) => {
              const p = parseLocal(d + "T00:00");
              return (
                <button
                  key={d}
                  className="day"
                  aria-pressed={date === d}
                  onClick={() => {
                    setDate(d);
                    setTime(null);
                  }}
                >
                  <span>{["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][p.getDay()]}</span>
                  <b>{p.getDate()}</b>
                </button>
              );
            })}
          </div>
          <div className="small muted">
            {capitalize(formatDay(date + "T00:00"))} · {staff.name} · {duration} min
          </div>
          {slots.length > 0 ? (
            <div className="times" role="radiogroup" aria-label="Hora">
              {slots.map((t) => (
                <button key={t} className="chip" role="radio" aria-checked={time === timePart(t)} onClick={() => setTime(timePart(t))}>
                  {timePart(t)}
                </button>
              ))}
            </div>
          ) : (
            <div className="card stack">
              <b>No quedan huecos para {duration} min este día</b>
              <p className="small muted">Elige otro día o apúntate a la lista de espera: si se libera algo compatible te lo ofreceremos, sin tocar ninguna otra cita tuya.</p>
              <div className="row">
                <label className="field grow">
                  <span className="label">Desde</span>
                  <input className="input" type="time" value={waitFrom} onChange={(e) => setWaitFrom(e.target.value)} />
                </label>
                <label className="field grow">
                  <span className="label">Hasta</span>
                  <input className="input" type="time" value={waitTo} onChange={(e) => setWaitTo(e.target.value)} />
                </label>
              </div>
              <button className="btn outline block" onClick={joinWaitlist}>
                <Icon name="bell" size={18} /> Avísame si se libera algo
              </button>
            </div>
          )}
          <button className="btn primary block" disabled={!time} onClick={() => setStep(3)}>
            Continuar
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <p className="small muted">Todo es opcional. Puedes preparar tu visita con más detalle después de reservar.</p>
          <label className="field">
            <span className="label">¿Necesitas terminar antes de alguna hora?</span>
            <input className="input" type="time" value={finishBy} onChange={(e) => setFinishBy(e.target.value)} />
            <span className="hint">Es una petición: el local te confirmará si es posible con la duración del servicio.</span>
          </label>
          <div className="card tinted small">
            <b>Cómo prefieres tu sesión</b>
            <p className="muted">
              {[me.sessionStyle.tranquila && "Sesión tranquila", me.sessionStyle.explicarCambios && "Explicar los cambios", me.sessionStyle.consultarAntes && "Consultar antes de cambios importantes"]
                .filter(Boolean)
                .join(" · ") || "Sin preferencias indicadas"}
            </p>
            <a href="#/cliente/preferencias" className="xs">
              Cambiar en Perfil
            </a>
          </div>
          <button className="btn primary block" onClick={() => setStep(4)}>
            Revisar
          </button>
        </div>
      )}

      {step === 4 && staff && lines && time && (
        <div className="stack">
          <div className="card stack">
            <div className="row between">
              <span className="muted small">Cuándo</span>
              <b>
                {capitalize(formatDay(date + "T00:00"))} · {time}
              </b>
            </div>
            <div className="row between">
              <span className="muted small">Con</span>
              <b>{staff.name}</b>
            </div>
            <div className="row between">
              <span className="muted small">Dónde</span>
              <b className="small">{location.name}</b>
            </div>
            <hr className="divider" />
            {lines.map((l) => (
              <div key={l.serviceId} className="row between">
                <span>
                  {l.name} <span className="xs muted">· {l.durationMin} min</span>
                </span>
                <span>
                  {l.priceKind === "desde" ? "desde " : ""}
                  {formatMoney(l.priceCents)}
                </span>
              </div>
            ))}
            <hr className="divider" />
            <div className="row between">
              <b>Total previsto</b>
              <b style={{ fontSize: "var(--fs-lg)" }}>
                {lines.some((l) => l.priceKind === "desde") ? "desde " : ""}
                {formatMoney(totalPrice(lines))}
              </b>
            </div>
            {lines.some((l) => l.priceKind === "desde") && (
              <p className="xs muted">Algún servicio requiere valoración en el local. Te confirmarán el importe antes de realizarlo.</p>
            )}
            {finishBy && <p className="xs muted">Has pedido terminar antes de las {finishBy}. Pendiente de confirmar por el local.</p>}
          </div>
          <Notice icon="info">
            El pago se hace en el local; esta app no cobra nada. Condiciones de cancelación: pendientes de definir con el negocio (demo).
          </Notice>
          <button className="btn primary block" onClick={confirm} disabled={busy}>
            {busy ? "Confirmando…" : "Confirmar reserva"}
          </button>
        </div>
      )}
    </div>
  );
}
