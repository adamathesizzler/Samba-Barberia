// Gestión mínima del propietario (apartado 51): catálogo, bloqueos de agenda y registro de auditoría.
// La gestión completa del negocio llega en el MVP (docs/H-plan-mvp.md).

import { useState } from "react";
import { useStore } from "../../app/store";
import { datePart, formatMoney } from "../../domain/time";
import { Notice, PageHeader } from "../../ui/common";

export function Management() {
  const { state, actor, be, now, toast } = useStore();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [block, setBlock] = useState({ staffId: "", from: "17:00", to: "18:00" });
  if (actor.kind !== "staff") return null;
  const services = state.services.filter((s) => s.businessId === actor.businessId);
  const team = state.staff.filter((s) => s.businessId === actor.businessId && s.role !== "propietario");
  const audit = state.audit.slice(-25).reverse();

  return (
    <div className="page wide">
      <PageHeader title="Gestión" />
      <Notice icon="info">Vista mínima del prototipo. Cambiar un precio no altera las citas ya reservadas ni el historial: cada una guarda su propio importe.</Notice>

      <section className="section">
        <div className="section-title">Catálogo</div>
        <div className="list">
          {services.map((s) => (
            <div key={s.id} className="list-item">
              <span className="grow">
                <b>{s.name}</b>
                <div className="xs muted">
                  {s.durationMin} min · {s.priceKind === "desde" ? "desde " : ""}
                  {formatMoney(s.priceCents)}
                </div>
              </span>
              <input
                className="input"
                style={{ width: 90 }}
                inputMode="decimal"
                aria-label={`Nuevo precio de ${s.name}`}
                placeholder={(s.priceCents / 100).toString()}
                value={prices[s.id] ?? ""}
                onChange={(e) => setPrices((p) => ({ ...p, [s.id]: e.target.value }))}
              />
              <button
                className="btn outline sm"
                disabled={!prices[s.id]}
                onClick={() => {
                  be.updateServicePrice(actor, s.id, Math.round(parseFloat(prices[s.id].replace(",", ".")) * 100));
                  setPrices((p) => ({ ...p, [s.id]: "" }));
                  toast("Precio actualizado para nuevas reservas");
                }}
              >
                Guardar
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="section card">
        <div className="section-title">Bloquear agenda hoy</div>
        <div className="row wrap">
          <select className="select" style={{ flex: 1, minWidth: 140 }} value={block.staffId} onChange={(e) => setBlock({ ...block, staffId: e.target.value })} aria-label="Profesional">
            <option value="">Profesional…</option>
            {team.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input className="input" style={{ width: 110 }} type="time" value={block.from} onChange={(e) => setBlock({ ...block, from: e.target.value })} aria-label="Desde" />
          <input className="input" style={{ width: 110 }} type="time" value={block.to} onChange={(e) => setBlock({ ...block, to: e.target.value })} aria-label="Hasta" />
        </div>
        <button
          className="btn primary"
          disabled={!block.staffId || block.to <= block.from}
          onClick={() => {
            const d = datePart(now);
            const clash = state.appointments.filter((a) => a.staffId === block.staffId && ["confirmada", "modificada"].includes(a.status) && a.start < `${d}T${block.to}` && `${d}T${block.from}` < a.end);
            be.addException(actor, { staffId: block.staffId, start: `${d}T${block.from}`, end: `${d}T${block.to}`, kind: "bloqueo" });
            toast(clash.length ? `Bloqueado. Atención: ${clash.length} cita(s) en ese tramo siguen activas; gestiónalas con el cliente.` : "Tramo bloqueado");
          }}
        >
          Bloquear tramo
        </button>
        <span className="xs muted">Bloquear no cancela citas en silencio: si hay alguna en ese tramo, se avisa para gestionarla.</span>
      </section>

      <section className="section">
        <div className="section-title">Registro de actividad</div>
        <div className="list">
          {audit.map((l) => (
            <div key={l.id} className="list-item xs">
              <span className="code muted" style={{ width: 110 }}>
                {l.at.replace("T", " ").slice(5)}
              </span>
              <span className="grow">
                <b>{l.action}</b> · {l.actor}
                {l.detail ? ` · ${l.detail}` : ""}
              </span>
            </div>
          ))}
          {audit.length === 0 && <div className="list-item small muted">Aún no hay actividad en esta demo.</div>}
        </div>
      </section>
    </div>
  );
}
