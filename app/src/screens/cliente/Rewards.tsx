// Fidelización (29–32), actividad económica (33), lista de espera (28) y Style AI como vista futura (22).

import { useState } from "react";
import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { achievementsFor, loyaltyProgress, spendingSummary } from "../../domain/queries";
import { formatDay, formatMoney, timePart } from "../../domain/time";
import { Icon } from "../../ui/Icon";
import { Empty, Notice, PageHeader, Segmented, SimBadge } from "../../ui/common";
import { AchievementCard, LoyaltyBlock, RewardCard, capitalize } from "../../ui/product";

export function Rewards() {
  const { state, actor } = useStore();
  const [tab, setTab] = useState<"disponible" | "utilizada" | "caducada">("disponible");
  if (actor.kind !== "cliente") return null;
  const me = state.customers.find((c) => c.id === actor.customerId)!;
  const businessId = me.businessIds[0];
  const loyalty = loyaltyProgress(state, me.id, businessId);
  const achievements = achievementsFor(state, me.id, businessId);
  const rewards = state.rewards.filter((r) => r.customerId === me.id);
  const shown = rewards.filter((r) => r.status === tab);

  return (
    <div className="page">
      <PageHeader title="Recompensas" backTo="/cliente/perfil" />
      {loyalty && <LoyaltyBlock inCycle={loyalty.inCycle} goal={loyalty.program.goal} rewardName={loyalty.program.rewardName} />}
      {loyalty && (
        <p className="xs muted">
          Cuenta cada visita atendida en {state.businesses.find((b) => b.id === businessId)?.name}. Reservar no suma; cancelar tampoco. Reglas de demostración, no condiciones comerciales.
        </p>
      )}

      <section className="section">
        <div className="section-title">Logros</div>
        <div className="medals">
          {achievements.map((a) => (
            <AchievementCard key={a.achievement.id} a={a.achievement} state={a.state} count={a.count} reachedAt={a.reachedAt} />
          ))}
        </div>
        <p className="xs muted">Los logros son reconocimientos; no todos incluyen un premio.</p>
      </section>

      <section className="section">
        <div className="section-title">Monedero</div>
        <Segmented
          label="Monedero"
          value={tab}
          onChange={setTab}
          options={[
            { key: "disponible", label: "Disponibles" },
            { key: "utilizada", label: "Utilizadas" },
            { key: "caducada", label: "Caducadas" },
          ]}
        />
        {shown.length === 0 ? (
          <Empty icon="gift" title={tab === "disponible" ? "No tienes recompensas disponibles" : "Nada por aquí"}>
            {tab === "disponible" && loyalty ? `Te faltan ${loyalty.remaining} visitas para la siguiente.` : undefined}
          </Empty>
        ) : (
          shown.map((r) => <RewardCard key={r.id} reward={r} />)
        )}
      </section>
    </div>
  );
}

export function Activity() {
  const { state, actor, now } = useStore();
  const [year, setYear] = useState(Number(now.slice(0, 4)));
  if (actor.kind !== "cliente") return null;
  const s = spendingSummary(state, actor.customerId, year);
  return (
    <div className="page">
      <PageHeader title="Mi actividad" backTo="/cliente/perfil" />
      <Segmented
        label="Año"
        value={String(year)}
        onChange={(y) => setYear(Number(y))}
        options={[year - 1, year, year + 1].filter((y) => y <= Number(now.slice(0, 4))).map((y) => ({ key: String(y), label: y }))}
      />
      {s.visits === 0 ? (
        <Empty icon="euro" title={`Sin visitas en ${year}`} />
      ) : (
        <>
          <div className="card stack">
            <span className="small muted">Este año</span>
            <span className="title-xl">{formatMoney(s.totalCents)}</span>
            <span className="small">
              {s.visits} visitas · media {formatMoney(s.averageCents)} por visita
            </span>
          </div>
          <div className="grid-2">
            <div className="card stack tight">
              <span className="xs muted">Servicios</span>
              <b>{formatMoney(s.servicesCents)}</b>
            </div>
            <div className="card stack tight">
              <span className="xs muted">Productos comprados</span>
              <b>{formatMoney(s.productsCents)}</b>
            </div>
          </div>
          <section className="section">
            <div className="section-title">Servicios más frecuentes</div>
            <div className="list">
              {s.topServices.map(([name, n]) => (
                <button key={name} className="list-item" onClick={() => navigate("/cliente/historial?tab=visitas")}>
                  <span className="grow">{name}</span>
                  <span className="muted small">{n} veces</span>
                  <Icon name="chevronRight" />
                </button>
              ))}
            </div>
          </section>
          <p className="xs muted">
            Suma los importes finales registrados en el local. No incluye citas canceladas, ni productos solo recomendados o usados durante el servicio. Registrar un importe no significa que la app haya cobrado.
          </p>
        </>
      )}
    </div>
  );
}

export function Waitlist() {
  const { state, actor, be, toast } = useStore();
  if (actor.kind !== "cliente") return null;
  const requests = state.waitlist.filter((w) => w.customerId === actor.customerId).slice().reverse();
  const label = { activa: "Esperando", oferta_enviada: "Oferta disponible", aceptada: "Aceptada", caducada: "Caducada", cancelada: "Cancelada" };
  return (
    <div className="page">
      <PageHeader title="Lista de espera" backTo="/cliente/perfil" />
      {requests.length === 0 && (
        <Empty icon="bell" title="No estás en ninguna lista de espera">
          Si no encuentras hueco al reservar, podrás pedir que te avisemos.
        </Empty>
      )}
      {requests.map((w) => {
        const staff = w.offer ? state.staff.find((s) => s.id === w.offer!.staffId) : undefined;
        const original = w.originalAppointmentId ? state.appointments.find((a) => a.id === w.originalAppointmentId) : undefined;
        return (
          <article key={w.id} className="card stack">
            <div className="row between">
              <b>{w.serviceIds.map((id) => state.services.find((s) => s.id === id)?.name).join(" + ")}</b>
              <span className={`badge ${w.status === "oferta_enviada" ? "warning" : w.status === "aceptada" ? "success" : ""}`}>{label[w.status]}</span>
            </div>
            <span className="small muted">
              {capitalize(formatDay(w.date + "T00:00"))} · entre {w.timeFrom} y {w.timeTo}
            </span>
            {original && <span className="xs muted">Tu cita actual ({formatDay(original.start)} {timePart(original.start)}) se mantiene hasta que aceptes otra.</span>}
            {w.status === "oferta_enviada" && w.offer && (
              <>
                <Notice tone="warning" icon="clock">
                  Hueco libre: {capitalize(formatDay(w.offer.start))} a las {timePart(w.offer.start)} con {staff?.name}. Reservado para ti hasta las {timePart(w.offer.expiresAt)}.
                </Notice>
                <div className="row">
                  <button
                    className="btn primary grow"
                    onClick={() => {
                      const r = be.acceptOffer(actor, w.id);
                      toast(r.ok ? "Nueva cita confirmada" : r.message);
                      if (r.ok) navigate(`/cliente/cita/${r.appointment.id}?nueva=1`);
                    }}
                  >
                    Aceptar
                  </button>
                  <button className="btn outline grow" onClick={() => be.declineOffer(actor, w.id)}>
                    No me interesa
                  </button>
                </div>
              </>
            )}
            {w.status === "activa" && (
              <button className="btn ghost sm" onClick={() => be.cancelWaitlist(actor, w.id)}>
                Salir de la lista
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function StyleAI() {
  return (
    <div className="page">
      <PageHeader title="Style AI" backTo="/cliente/inicio" />
      <SimBadge>Fase 3 · no conectado</SimBadge>
      <Empty icon="sparkle" title="Todavía no disponible">
        Aquí podrás subir tus fotos y recibir propuestas orientativas enlazadas con trabajos reales del local. No hay ningún proveedor de IA conectado en este prototipo, así que no se genera nada.
      </Empty>
      <Notice icon="info">
        Cuando llegue: participación voluntaria, sin puntuar tu aspecto ni inferir datos sensibles, y cada simulación marcada como tal. Reservar nunca dependerá de la IA.
      </Notice>
    </div>
  );
}
