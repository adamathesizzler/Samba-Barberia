// 04 · Reservar cita (diseño v1.0): una sola pantalla, rápida. Servicios → barbero → día → hora
// → preparar mi visita → total → confirmar. El hueco se valida al confirmar (apartados 9, 10, 15, 28).

import { useMemo, useState } from "react";
import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { freeSlots, priceServicesFor, staffForServices, totalDuration, totalPrice } from "../../domain/availability";
import { customerSessions } from "../../domain/queries";
import { addDays, datePart, formatMoney, parseLocal, timePart, weekday } from "../../domain/time";
import type { PreparationMode } from "../../domain/types";
import { Icon } from "../../ui/Icon";
import { Avatar, Notice, PageHeader, PhotoArt, Sheet } from "../../ui/common";
import { haptic } from "../../ui/motion";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function Booking({ query }: { query: URLSearchParams }) {
  const { state, actor, now, be, toast } = useStore();
  const me = actor.kind === "cliente" ? state.customers.find((c) => c.id === actor.customerId)! : null;
  const repeatEntry = state.styleEntries.find((e) => e.id === query.get("repetir") && e.customerId === me?.id);
  const repeatSession = repeatEntry && state.sessions.find((s) => s.id === repeatEntry.sessionId);
  const businessId = repeatSession?.businessId ?? me?.businessIds[0] ?? state.businesses[0].id;
  const location = state.locations.find((l) => l.businessId === businessId)!;
  const refPhoto = state.photos.find((p) => p.id === query.get("ref"));
  const lastEntry = me ? state.styleEntries.find((e) => e.sessionId === customerSessions(state, me.id)[0]?.id) : undefined;

  const initialServices = repeatSession
    ? repeatSession.services.map((l) => l.serviceId).filter((id) => state.services.some((s) => s.id === id && s.active))
    : (query.get("servicios")?.split(",").filter(Boolean) ?? []);

  const [serviceIds, setServiceIds] = useState<string[]>(initialServices);
  const [staffId, setStaffId] = useState(query.get("profesional") ?? (repeatSession?.staffId || me?.preferredStaffId || ""));
  const [date, setDate] = useState(datePart(now));
  const [time, setTime] = useState<string | null>(null);
  const [mode, setMode] = useState<PreparationMode | null>(repeatEntry ? "elegir_anterior" : refPhoto ? "subir_referencia" : null);
  const [keep, setKeep] = useState("");
  const [change, setChange] = useState("");
  const [finishBy, setFinishBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickBarber, setPickBarber] = useState(false);
  const [waitFrom, setWaitFrom] = useState("09:00");
  const [waitTo, setWaitTo] = useState("20:00");

  const services = state.services.filter((s) => s.businessId === businessId && s.active);
  const capable = staffForServices(state, businessId, serviceIds);
  const staff = capable.find((s) => s.id === staffId) ?? (serviceIds.length ? capable[0] : undefined);
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

  const toggle = (id: string) => {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    setTime(null);
  };

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
      haptic("warning");
      setError(r.message);
      setTime(null);
      document.getElementById("horarios")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (mode || keep.trim() || change.trim()) {
      const m = mode ?? "quiero_cambiar";
      be.savePreparation(actor, r.appointment.id, {
        mode: m,
        styleEntryId: m === "elegir_anterior" ? repeatEntry?.id : m === "repetir_ultimo" ? lastEntry?.id : undefined,
        referencePhotoId: m === "subir_referencia" ? refPhoto?.id : undefined,
        keep: keep.trim(),
        change: change.trim(),
        note: "",
      });
    }
    haptic("success");
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

  const modes: { key: PreparationMode; label: string; show: boolean }[] = [
    { key: "elegir_anterior", label: `Repetir «${repeatEntry?.title ?? ""}»`, show: !!repeatEntry },
    { key: "repetir_ultimo", label: "Repetir último look", show: !!lastEntry && !repeatEntry },
    { key: "subir_referencia", label: "Con la referencia elegida", show: !!refPhoto },
    { key: "quiero_cambiar", label: "Quiero cambiar", show: true },
    { key: "consultar_barbero", label: "Lo hablo con mi barbero", show: true },
  ];

  return (
    <div className="page" style={{ paddingBottom: 190 }}>
      <PageHeader title="Reservar cita" backTo="/cliente/inicio" />

      {refPhoto && (
        <div className="row card tinted">
          <PhotoArt hue={refPhoto.hue} view={refPhoto.view} img={refPhoto.img} label={null} style={{ width: 48, height: 60, borderRadius: 12, flexShrink: 0 }} />
          <span className="small">Tu referencia irá con la reserva. Tu barbero confirmará la adaptación.</span>
        </div>
      )}

      <section className="section" aria-label="Servicios">
        <div className="section-title">Servicios</div>
        <div className="stack" style={{ gap: 8 }} role="group">
          {services.map((s) => {
            const on = serviceIds.includes(s.id);
            return (
              <button key={s.id} className="svc-card" role="checkbox" aria-checked={on} onClick={() => toggle(s.id)}>
                <span className="tick" aria-hidden="true">
                  {on && <Icon name="check" size={14} strokeWidth={3} />}
                </span>
                <span className="grow">
                  <b>{s.name}</b>
                  <div className="xs muted">{s.durationMin} min</div>
                </span>
                <b className="small">
                  {s.priceKind === "desde" ? "desde " : ""}
                  {formatMoney(s.priceCents)}
                </b>
              </button>
            );
          })}
        </div>
      </section>

      {serviceIds.length > 0 && (
        <section className="section" aria-label="Barbero">
          {capable.length === 0 ? (
            <Notice tone="warning">Ningún barbero hace todos esos servicios juntos. Prueba a reservarlos por separado.</Notice>
          ) : (
            staff && (
              <button className="barber-card" onClick={() => setPickBarber(true)} aria-label="Cambiar de barbero">
                <Avatar name={staff.name} hue={staff.hue} src={staff.photo} />
                <span className="grow">
                  <b>Con {staff.name}</b>
                  <div className="xs muted">{staff.id === me.preferredStaffId ? "Tu barbero de siempre" : staff.specialties.join(" · ")}</div>
                </span>
                {capable.length > 1 && <span className="xs muted">Cambiar</span>}
                <Icon name="chevronRight" />
              </button>
            )
          )}
        </section>
      )}

      {staff && lines && (
        <>
          <div className="date-row" role="group" aria-label="Día">
            {days.map((d) => {
              const p = parseLocal(d + "T00:00");
              return (
                <button
                  key={d}
                  className="date-chip"
                  aria-pressed={date === d}
                  onClick={() => {
                    setDate(d);
                    setTime(null);
                    setError(null);
                  }}
                >
                  <span>{DAYS[p.getDay()]}</span>
                  <b>{p.getDate()}</b>
                  <span>{MONTHS[p.getMonth()]}</span>
                </button>
              );
            })}
          </div>

          <section className="section" id="horarios" aria-label="Horarios disponibles">
            <div className="section-title">
              Horarios disponibles <span className="section-count">{duration} min</span>
            </div>
            {error && (
              <Notice tone="danger" icon="alert">
                {error}
              </Notice>
            )}
            {slots.length > 0 ? (
              <div className="time-grid" role="radiogroup" aria-label="Hora">
                {slots.map((t) => (
                  <button key={t} className="time-chip" role="radio" aria-checked={time === timePart(t)} onClick={() => setTime(timePart(t))}>
                    {timePart(t)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="card stack">
                <b>Sin huecos de {duration} min este día</b>
                <p className="small muted">Elige otro día o te avisamos si se libera algo.</p>
                <div className="row">
                  <label className="field grow">
                    <span className="label">Desde</span>
                    <input id="espera-desde" className="input" type="time" value={waitFrom} onChange={(e) => setWaitFrom(e.target.value)} />
                  </label>
                  <label className="field grow">
                    <span className="label">Hasta</span>
                    <input id="espera-hasta" className="input" type="time" value={waitTo} onChange={(e) => setWaitTo(e.target.value)} />
                  </label>
                </div>
                <button className="btn outline block" onClick={joinWaitlist}>
                  <Icon name="bell" size={18} /> Avísame si se libera algo
                </button>
              </div>
            )}
          </section>

          <section className="section card" aria-label="Preparar mi visita">
            <div className="row between">
              <b>Preparar mi visita</b>
              <span className="xs muted">Opcional</span>
            </div>
            <div className="chips" style={{ flexWrap: "wrap" }} role="radiogroup">
              {modes
                .filter((m) => m.show)
                .map((m) => (
                  <button key={m.key} className="chip" role="radio" aria-checked={mode === m.key} onClick={() => setMode(mode === m.key ? null : m.key)}>
                    {m.label}
                  </button>
                ))}
            </div>
            <label className="field">
              <span className="label">Esto sí · qué mantener</span>
              <input id="prep-keep" className="input" value={keep} onChange={(e) => setKeep(e.target.value)} placeholder="Ej.: mismo estilo, la barba igual" />
            </label>
            <label className="field">
              <span className="label">Esto no · qué cambiar</span>
              <input id="prep-change" className="input" value={change} onChange={(e) => setChange(e.target.value)} placeholder="Ej.: un poco más corto a los lados" />
            </label>
            <details>
              <summary className="small muted">Más opciones</summary>
              <label className="field" style={{ marginTop: 8 }}>
                <span className="label">Necesito terminar antes de</span>
                <input id="prep-finish" className="input" type="time" value={finishBy} onChange={(e) => setFinishBy(e.target.value)} />
                <span className="hint">Es una petición: el local te confirmará si es posible.</span>
              </label>
            </details>
          </section>

          <section className="card stack" aria-label="Total previsto">
            {lines.map((l) => (
              <div key={l.serviceId} className="total-line">
                <span>
                  {l.name} · {l.durationMin} min
                </span>
                <span>
                  {l.priceKind === "desde" ? "desde " : ""}
                  {formatMoney(l.priceCents)}
                </span>
              </div>
            ))}
            <hr className="divider" />
            <div className="total-line">
              <span style={{ color: "var(--text)", fontWeight: 600 }}>Total previsto</span>
              <b>
                {lines.some((l) => l.priceKind === "desde") ? "desde " : ""}
                {formatMoney(totalPrice(lines))}
              </b>
            </div>
            <span className="xs muted">Pagas en el local.</span>
          </section>
        </>
      )}

      <div className="action-bar">
        <button className="pill-cta dark" disabled={!staff || !time || busy} onClick={confirm}>
          {busy ? "Confirmando…" : time ? `Confirmar cita · ${time}` : "Confirmar cita"}
          <span className="knob" aria-hidden="true">
            <Icon name="arrowRight" size={20} strokeWidth={2.2} />
          </span>
        </button>
      </div>

      {pickBarber && (
        <Sheet title="Elige barbero" onClose={() => setPickBarber(false)}>
          <div className="stack" style={{ gap: 8 }}>
            {capable.map((s) => {
              const l = priceServicesFor(state, s.id, serviceIds)!;
              return (
                <button
                  key={s.id}
                  className="barber-card"
                  aria-pressed={staff?.id === s.id}
                  style={staff?.id === s.id ? { borderColor: "var(--selected)" } : undefined}
                  onClick={() => {
                    setStaffId(s.id);
                    setTime(null);
                    setPickBarber(false);
                  }}
                >
                  <Avatar name={s.name} hue={s.hue} src={s.photo} />
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
        </Sheet>
      )}
    </div>
  );
}

