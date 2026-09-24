// Vista diaria del profesional (17), check-in por QR o manual (13, 41), canje (32) y cliente sin reserva (40).

import { useState } from "react";
import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { staffAgenda } from "../../domain/queries";
import { datePart, formatDay, formatMoney, timePart } from "../../domain/time";
import type { Appointment } from "../../domain/types";
import { Icon } from "../../ui/Icon";
import { Empty, Notice, PageHeader, SimBadge, StatusBadge, statusLabel } from "../../ui/common";
import { capitalize } from "../../ui/product";

function useStaff() {
  const { state, actor } = useStore();
  if (actor.kind !== "staff") throw new Error("Solo personal");
  const me = state.staff.find((s) => s.id === actor.staffId)!;
  const manager = actor.role !== "barbero";
  return { me, actor, manager };
}

export function Today() {
  const { state, now } = useStore();
  const { me, manager } = useStaff();
  const team = state.staff.filter((s) => s.businessId === me.businessId && s.role !== "propietario");
  const [staffId, setStaffId] = useState(manager ? team[0].id : me.id);
  const viewing = state.staff.find((s) => s.id === staffId)!;
  const today = datePart(now);
  const agenda = staffAgenda(state, staffId, today);
  const breaks = state.exceptions.filter((e) => e.staffId === staffId && datePart(e.start) === today);
  const rows = [
    ...agenda.map((a) => ({ kind: "appt" as const, start: a.start, a })),
    ...breaks.map((b) => ({ kind: "break" as const, start: b.start, b })),
  ].sort((x, y) => x.start.localeCompare(y.start));
  const pending = agenda.filter((a) => ["confirmada", "modificada"].includes(a.status)).length;
  const inProgress = agenda.find((a) => a.status === "en_atencion" || a.status === "llegada");

  return (
    <div className="page wide">
      <header className="stack tight">
        <span className="small muted">{capitalize(formatDay(now))}</span>
        <h1 className="title-xl">{manager ? "Agenda del equipo" : `Hoy, ${me.name}`}</h1>
      </header>
      {manager && (
        <div className="chips" role="radiogroup" aria-label="Profesional">
          {team.map((s) => (
            <button key={s.id} className="chip" role="radio" aria-checked={staffId === s.id} onClick={() => setStaffId(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <div className="card grow stack tight">
          <span className="xs muted">Pendientes</span>
          <b style={{ fontSize: "var(--fs-xl)" }}>{pending}</b>
        </div>
        <div className="card grow stack tight">
          <span className="xs muted">Ahora</span>
          <b className="small">{inProgress ? `${state.customers.find((c) => c.id === inProgress.customerId)?.name}` : "—"}</b>
        </div>
      </div>
      <div className="row">
        <button className="btn primary grow" onClick={() => navigate("/pro/escanear")}>
          <Icon name="scan" size={18} /> Escanear QR
        </button>
        <button className="btn outline grow" onClick={() => navigate("/pro/sin-reserva")}>
          <Icon name="plus" size={18} /> Sin reserva
        </button>
      </div>

      <section className="section">
        <div className="section-title">
          {viewing.name} · {agenda.filter((a) => a.status !== "cancelada").length} citas
        </div>
        {rows.length === 0 ? (
          <Empty icon="calendar" title="Sin citas hoy" />
        ) : (
          <div className="timeline">
            {rows.map((r) =>
              r.kind === "break" ? (
                <div key={r.b.id} className="slot break" aria-label={`${r.b.kind} de ${timePart(r.b.start)} a ${timePart(r.b.end)}`}>
                  <time>{timePart(r.b.start)}</time>
                  <span className="small">
                    {capitalize(r.b.kind)} hasta {timePart(r.b.end)} · no reservable
                  </span>
                  <span />
                </div>
              ) : (
                <AgendaSlot key={r.a.id} a={r.a} />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function AgendaSlot({ a }: { a: Appointment }) {
  const { state } = useStore();
  const c = state.customers.find((x) => x.id === a.customerId)!;
  const prep = state.preparations.find((p) => p.appointmentId === a.id);
  const muted = a.status === "cancelada" || a.status === "completada" || a.status === "ausencia";
  return (
    <button className={`slot ${muted ? "muted-slot" : ""}`} onClick={() => navigate(`/pro/ficha/${a.id}`)} disabled={a.status === "cancelada"}>
      <time>{timePart(a.start)}</time>
      <span className="stack tight" style={{ minWidth: 0 }}>
        <b className="small">
          {c.name} {c.guest && <span className="badge">Sin cuenta</span>}
        </b>
        <span className="xs muted">
          {a.services.map((s) => s.name).join(" + ")} · hasta {timePart(a.end)}
          {a.source === "telefono" ? " · por teléfono" : a.source === "sin_reserva" ? " · sin reserva" : ""}
        </span>
        {prep && !muted && (
          <span className="xs" style={{ color: prep.changedAfterSeen ? "var(--warning)" : "var(--text-2)" }}>
            <Icon name="sparkle" size={12} /> {prep.changedAfterSeen ? "Preparación modificada" : "Ha preparado su visita"}
          </span>
        )}
      </span>
      <StatusBadge status={a.status} />
    </button>
  );
}

type ScanResult = { tone: "success" | "warning" | "danger"; title: string; text?: string; appointmentId?: string };

export function Scan() {
  const { state, be, now } = useStore();
  const { actor, me } = useStaff();
  const [token, setToken] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const today = datePart(now);

  const run = (ref: { token: string } | { appointmentId: string }) => {
    const r = be.checkIn(actor, ref);
    if (r.ok)
      setResult(
        r.status === "registrado"
          ? { tone: "success", title: "Llegada registrada", text: `${state.customers.find((c) => c.id === r.appointment.customerId)?.name} · ${timePart(r.appointment.start)}`, appointmentId: r.appointment.id }
          : { tone: "warning", title: "Ya registrado", text: "Esta llegada ya estaba registrada. No se ha duplicado.", appointmentId: r.appointment.id },
      );
    else setResult({ tone: "danger", title: "No se puede registrar", text: r.message });
  };

  // Búsqueda manual: solo citas de hoy de este negocio, y solo para personal autenticado.
  const matches = query.trim().length >= 2
    ? state.appointments.filter((a) => {
        if (a.businessId !== me.businessId || datePart(a.start) !== today) return false;
        const c = state.customers.find((x) => x.id === a.customerId)!;
        const q = query.trim().toLowerCase().replace("#", "");
        return c.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
      })
    : [];

  const demoTargets = [
    ...state.appointments.filter((a) => a.businessId === me.businessId && datePart(a.start) === today && a.status !== "completada").slice(0, 5),
  ];
  const foreign = state.appointments.find((a) => a.businessId !== me.businessId);

  return (
    <div className="page">
      <PageHeader title="Registrar llegada" backTo="/pro/hoy" />
      {result && (
        <Notice tone={result.tone} icon={result.tone === "danger" ? "alert" : "check"}>
          <b>{result.title}</b>
          {result.text && <div>{result.text}</div>}
          {result.appointmentId && (
            <button className="btn primary sm" style={{ marginTop: 8 }} onClick={() => navigate(`/pro/ficha/${result.appointmentId}`)}>
              Abrir ficha
            </button>
          )}
        </Notice>
      )}

      <section className="card stack">
        <div className="row between">
          <b>Cámara</b>
          <SimBadge>Simulada en el prototipo</SimBadge>
        </div>
        <p className="small muted">El prototipo no abre la cámara. Pega el contenido del QR o usa los controles de demostración.</p>
        <label className="field">
          <span className="label">Contenido del QR</span>
          <input className="input code" value={token} onChange={(e) => setToken(e.target.value)} placeholder="SAMBA-CHECKIN:…" />
        </label>
        <button className="btn primary block" disabled={!token.trim()} onClick={() => run({ token: token.replace("SAMBA-CHECKIN:", "") })}>
          Validar
        </button>
        <details>
          <summary className="small">Controles de demo: simular que un cliente muestra su QR</summary>
          <div className="stack" style={{ marginTop: 8 }}>
            {demoTargets.map((a) => (
              <button key={a.id} className="btn outline sm" onClick={() => run({ token: a.qrToken })}>
                QR de {state.customers.find((c) => c.id === a.customerId)?.name} · {timePart(a.start)} ({statusLabel(a.status).toLowerCase()})
              </button>
            ))}
            {foreign && (
              <button className="btn outline sm" onClick={() => run({ token: foreign.qrToken })}>
                QR de otra barbería
              </button>
            )}
            <button className="btn outline sm" onClick={() => run({ token: "codigo-inventado" })}>
              QR no válido
            </button>
          </div>
        </details>
      </section>

      <section className="card stack">
        <b>Sin QR: buscar en la agenda de hoy</b>
        <p className="small muted">Batería agotada, pase que no abre o cámara sin permiso: localiza la reserva y verifica con el cliente.</p>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre o código de reserva" aria-label="Buscar reserva de hoy" />
        {matches.map((a) => (
          <div key={a.id} className="row">
            <span className="grow small">
              <b>{state.customers.find((c) => c.id === a.customerId)?.name}</b> · {timePart(a.start)} · #{a.code}
            </span>
            <StatusBadge status={a.status} />
            <button className="btn primary sm" onClick={() => run({ appointmentId: a.id })} disabled={!["confirmada", "modificada"].includes(a.status)}>
              Registrar
            </button>
          </div>
        ))}
        {query.trim().length >= 2 && matches.length === 0 && <span className="small muted">Ninguna reserva de hoy coincide.</span>}
      </section>
    </div>
  );
}

export function Redeem() {
  const { state, be, now } = useStore();
  const { actor, me } = useStaff();
  const [code, setCode] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const todays = state.appointments.filter((a) => a.businessId === me.businessId && datePart(a.start) === datePart(now) && a.status !== "cancelada");
  const customers = [...new Map(todays.map((a) => [a.customerId, state.customers.find((c) => c.id === a.customerId)!])).values()];
  return (
    <div className="page">
      <PageHeader title="Canjear recompensa" backTo="/pro/hoy" />
      <p className="small muted">Se comprueba que el código pertenece al cliente, que está vigente y que no se ha usado. Una captura de pantalla no basta.</p>
      <label className="field">
        <span className="label">Cliente (citas de hoy)</span>
        <select className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Elige cliente…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Código de la recompensa</span>
        <input className="input code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="R12345" />
      </label>
      <button
        className="btn primary block"
        disabled={!code.trim() || !customerId}
        onClick={() => {
          const r = be.redeemReward(actor, code, customerId);
          setMsg(r.ok ? { ok: true, text: `Canjeada: ${r.reward.name}. ${r.reward.benefit}.` } : { ok: false, text: r.message });
        }}
      >
        Validar y canjear
      </button>
      {msg && (
        <Notice tone={msg.ok ? "success" : "danger"} icon={msg.ok ? "check" : "alert"}>
          {msg.text}
        </Notice>
      )}
    </div>
  );
}

export function WalkIn() {
  const { state, be, toast } = useStore();
  const { actor, me, manager } = useStaff();
  const team = state.staff.filter((s) => s.businessId === me.businessId && s.role !== "propietario");
  const [name, setName] = useState("");
  const [staffId, setStaffId] = useState(manager ? team[0].id : me.id);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const available = state.staffServices.filter((l) => l.staffId === staffId).map((l) => state.services.find((s) => s.id === l.serviceId)!);
  return (
    <div className="page">
      <PageHeader title="Cliente sin reserva" backTo="/pro/hoy" />
      <p className="small muted">Ocupa la misma agenda que las reservas online. Solo hace falta un nombre; se podrá asociar a una cuenta verificada más adelante.</p>
      <label className="field">
        <span className="label">Nombre</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {manager && (
        <label className="field">
          <span className="label">Profesional</span>
          <select className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {team.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="chips" style={{ flexWrap: "wrap" }} role="group" aria-label="Servicios">
        {available.map((s) => (
          <button key={s.id} className="chip" aria-pressed={serviceIds.includes(s.id)} onClick={() => setServiceIds((ids) => (ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}>
            {s.name} · {formatMoney(s.priceCents)}
          </button>
        ))}
      </div>
      {err && <Notice tone="danger">{err}</Notice>}
      <button
        className="btn primary block"
        disabled={!serviceIds.length}
        onClick={() => {
          const r = be.walkIn(actor, { name, staffId, serviceIds });
          if (!r.ok) return setErr(r.message);
          toast("Cliente registrado y llegada confirmada");
          navigate(`/pro/ficha/${r.appointment.id}`);
        }}
      >
        Registrar y atender ahora
      </button>
    </div>
  );
}
