// Finalizar sesión en pocos pasos (apartados 18, 19, 26). Borrador local por si hay una interrupción.

import { useEffect, useState } from "react";
import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { priceServicesFor, totalPrice } from "../../domain/availability";
import { canAccessAppointment } from "../../domain/permissions";
import { customerSessions } from "../../domain/queries";
import { formatMoney } from "../../domain/time";
import type { PhotoView, Reward, Session } from "../../domain/types";
import { Icon } from "../../ui/Icon";
import { Empty, Notice, PageHeader, PhotoArt, Segmented, SimBadge } from "../../ui/common";
import { haptic } from "../../ui/motion";

const VIEWS: { key: PhotoView; label: string }[] = [
  { key: "frontal", label: "Frontal" },
  { key: "lateral_izq", label: "Lateral izq." },
  { key: "lateral_der", label: "Lateral der." },
  { key: "posterior", label: "Posterior" },
  { key: "detalle", label: "Detalle" },
];

interface Draft {
  serviceIds: string[];
  adjustment: string;
  adjustmentConfirmed: boolean;
  technicalNote: string;
  maintenance: string;
  productUsed: string;
  soldName: string;
  soldPrice: string;
  styleTitle: string;
  coverPhotoId?: string;
  payment: Session["payment"];
}

const draftKey = (id: string) => `samba.draft.cierre.${id}`;

export function CloseSession({ id }: { id: string }) {
  const { state, actor, be, toast } = useStore();
  const appt = state.appointments.find((a) => a.id === id);
  const allowed = !!appt && canAccessAppointment(actor, appt) && actor.kind === "staff";
  const last = appt ? customerSessions(state, appt.customerId, appt.businessId)[0] : undefined;

  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = localStorage.getItem(draftKey(id));
      if (saved) return JSON.parse(saved);
    } catch {
      /* sin borrador */
    }
    return {
      serviceIds: appt?.services.map((s) => s.serviceId) ?? [],
      adjustment: "",
      adjustmentConfirmed: false,
      technicalNote: "",
      maintenance: "",
      productUsed: "",
      soldName: "",
      soldPrice: "",
      styleTitle: "",
      payment: "registrado_en_local",
    };
  });
  const [failNext, setFailNext] = useState(false);
  const [done, setDone] = useState<{ session: Session; duplicated: boolean; rewards: Reward[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(id), JSON.stringify(draft));
    } catch {
      /* sin persistencia */
    }
  }, [draft, id]);

  if (!appt || !allowed)
    return (
      <div className="page">
        <PageHeader title="Finalizar sesión" backTo="/pro/hoy" />
        <Empty icon="lock" title="No tienes acceso a esta sesión" />
      </div>
    );

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const customer = state.customers.find((c) => c.id === appt.customerId)!;
  const available = state.staffServices.filter((l) => l.staffId === appt.staffId).map((l) => state.services.find((s) => s.id === l.serviceId)!).filter((s) => s.active);
  const lines = (priceServicesFor(state, appt.staffId, draft.serviceIds) ?? []).map((l) => appt.services.find((s) => s.serviceId === l.serviceId) ?? l);
  const added = draft.serviceIds.filter((sid) => !appt.services.some((s) => s.serviceId === sid));
  const adjustmentCents = Math.round((parseFloat(draft.adjustment.replace(",", ".")) || 0) * 100);
  const estimated = totalPrice(appt.services);
  const final = totalPrice(lines) + adjustmentCents;
  const changedAmount = final !== estimated;
  const photos = state.photos.filter((p) => p.appointmentId === appt.id && !p.sessionId && p.source === "profesional");
  const okPhotos = photos.filter((p) => p.status === "subida");

  if (done) {
    const progress = state.loyaltyMovements.filter((m) => m.customerId === appt.customerId && m.businessId === appt.businessId).length;
    const goal = state.loyaltyPrograms.find((p) => p.businessId === appt.businessId)?.goal ?? 10;
    return (
      <div className="page">
        <div className="empty card" style={{ paddingTop: "var(--s10)" }}>
          <span className="icon-btn" style={{ width: 64, height: 64, background: "var(--success-bg)", color: "var(--success)" }}>
            <Icon name="check" size={32} strokeWidth={2.4} />
          </span>
          <h3>{done.duplicated ? "Esta sesión ya estaba cerrada" : "Sesión cerrada"}</h3>
          <p className="small">
            {done.duplicated
              ? "No se ha creado otra visita ni se ha sumado de nuevo a la fidelización."
              : `Visita guardada en el historial de ${customer.name} · ${formatMoney(done.session.finalCents)} · ${done.session.photoIds.length} fotos.`}
          </p>
          {!done.duplicated && !customer.guest && (
            <span className="badge loyalty">
              Fidelización: {progress % goal === 0 ? goal : progress % goal} / {goal}
            </span>
          )}
          {done.rewards.map((r) => (
            <Notice key={r.id} tone="success" icon="gift">
              Recompensa desbloqueada para el cliente: {r.name}
            </Notice>
          ))}
          <button className="btn primary block" onClick={() => navigate("/pro/hoy")}>
            Volver a Hoy
          </button>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (submitting) return;
    if (changedAmount && !draft.adjustmentConfirmed) {
      setError("Confirma que el cliente ha aceptado el importe antes de finalizar.");
      return;
    }
    setSubmitting(true);
    const r = be.closeSession(actor, appt.id, {
      serviceIds: draft.serviceIds,
      adjustmentCents,
      technicalNote: draft.technicalNote,
      maintenance: draft.maintenance,
      productsUsed: draft.productUsed ? [draft.productUsed] : [],
      productsSold: draft.soldName && draft.soldPrice ? [{ name: draft.soldName, qty: 1, priceCents: Math.round(parseFloat(draft.soldPrice.replace(",", ".")) * 100) }] : [],
      photoIds: okPhotos.map((p) => p.id),
      coverPhotoId: draft.coverPhotoId,
      styleTitle: draft.styleTitle,
      payment: draft.payment,
    });
    setSubmitting(false);
    if (!r.ok) return setError(r.message);
    try {
      localStorage.removeItem(draftKey(id));
    } catch {
      /* nada */
    }
    haptic("success");
    setDone({ session: r.session, duplicated: r.duplicated, rewards: r.newRewards });
  };

  return (
    <div className="page">
      <PageHeader title="Finalizar sesión" backTo={`/pro/ficha/${appt.id}`} />
      <p className="small muted">
        {customer.name}. Solo corrige lo que haya cambiado; las fotos y los detalles son opcionales. El borrador se guarda solo.
      </p>

      <section className="section">
        <div className="section-title">1 · Servicios realizados</div>
        <div className="chips" style={{ flexWrap: "wrap" }}>
          {available.map((s) => (
            <button
              key={s.id}
              className="chip"
              aria-pressed={draft.serviceIds.includes(s.id)}
              onClick={() => set("serviceIds", draft.serviceIds.includes(s.id) ? draft.serviceIds.filter((x) => x !== s.id) : [...draft.serviceIds, s.id])}
            >
              {s.name}
            </button>
          ))}
        </div>
        {added.length > 0 && <span className="xs muted">Servicios añadidos en la sesión: se cobran a precio actual y deben haberse confirmado antes de hacerlos.</span>}
      </section>

      <section className="section card">
        <div className="section-title">2 · Importe</div>
        {lines.map((l) => (
          <div key={l.serviceId} className="row between small">
            <span>{l.name}</span>
            <span>{formatMoney(l.priceCents)}</span>
          </div>
        ))}
        <label className="field">
          <span className="label">Ajuste acordado (€, opcional)</span>
          <input className="input" inputMode="decimal" value={draft.adjustment} onChange={(e) => set("adjustment", e.target.value)} placeholder="0" />
        </label>
        <div className="row between">
          <span className="small muted">Previsto al reservar: {formatMoney(estimated)}</span>
          <b style={{ fontSize: "var(--fs-lg)" }}>{formatMoney(final)}</b>
        </div>
        {changedAmount && (
          <label className="check">
            <input type="checkbox" checked={draft.adjustmentConfirmed} onChange={(e) => set("adjustmentConfirmed", e.target.checked)} />
            <span className="small">El cliente ha confirmado este importe</span>
          </label>
        )}
      </section>

      <section className="section">
        <div className="row between">
          <div className="section-title">3 · Fotos (opcional)</div>
          <SimBadge>Cámara simulada</SimBadge>
        </div>
        <div className="chips" style={{ flexWrap: "wrap" }}>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              className="chip"
              onClick={() => {
                const r = be.uploadPhoto(actor, { appointmentId: appt.id, view: v.key, simulateFailure: failNext });
                if (!r.ok) toast(r.message);
                setFailNext(false);
              }}
            >
              <Icon name="camera" size={14} /> {v.label}
            </button>
          ))}
        </div>
        <label className="check xs muted">
          <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} /> Demo: simular que la próxima subida falla
        </label>
        {photos.length > 0 && (
          <div className="grid-photos">
            {photos.map((p) => (
              <div key={p.id} style={{ position: "relative" }}>
                <PhotoArt hue={p.hue} view={p.view} label={p.status === "fallida" ? "No subida" : draft.coverPhotoId === p.id || (!draft.coverPhotoId && okPhotos[0]?.id === p.id) ? "Portada" : null} style={{ width: "100%", height: "100%", opacity: p.status === "fallida" ? 0.4 : 1 }} />
                <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
                  {p.status === "fallida" ? (
                    <button className="icon-btn on-photo" style={{ width: 34, height: 34 }} aria-label="Reintentar subida" onClick={() => be.retryPhoto(actor, p.id)}>
                      <Icon name="repeat" size={16} />
                    </button>
                  ) : (
                    <button className="icon-btn on-photo" style={{ width: 34, height: 34 }} aria-label="Usar como portada" onClick={() => set("coverPhotoId", p.id)}>
                      <Icon name="star" size={16} />
                    </button>
                  )}
                  <button className="icon-btn on-photo" style={{ width: 34, height: 34 }} aria-label="Eliminar foto" onClick={() => be.removePendingPhoto(actor, p.id)}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {photos.some((p) => p.status === "fallida") && <Notice tone="danger">Hay fotos que no se han subido. No se guardarán en la visita salvo que el reintento funcione.</Notice>}
        <span className="xs muted">Las fotos quedan en el historial privado del cliente. Publicarlas en portfolio requiere su permiso.</span>
      </section>

      <section className="section">
        <div className="section-title">4 · Cambios importantes</div>
        <label className="field">
          <span className="label">Nota técnica (solo el equipo)</span>
          <textarea className="textarea" value={draft.technicalNote} onChange={(e) => set("technicalNote", e.target.value)} placeholder={last?.technicalNote || "Qué has hecho distinto hoy"} />
          {last?.technicalNote && !draft.technicalNote && (
            <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => set("technicalNote", last.technicalNote)}>
              Partir de la nota anterior
            </button>
          )}
        </label>
        <label className="field">
          <span className="label">Nombre del estilo (lo verá el cliente)</span>
          <input className="input" value={draft.styleTitle} onChange={(e) => set("styleTitle", e.target.value)} placeholder={lines.map((l) => l.name).join(" + ")} />
        </label>
      </section>

      <details className="card flat">
        <summary>
          <b>Más: mantenimiento y productos</b>
        </summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="field">
            <span className="label">Cómo mantenerlo (lo verá el cliente)</span>
            <textarea className="textarea" value={draft.maintenance} onChange={(e) => set("maintenance", e.target.value)} placeholder={last?.maintenance} />
          </label>
          <label className="field">
            <span className="label">Producto utilizado durante el servicio</span>
            <input className="input" value={draft.productUsed} onChange={(e) => set("productUsed", e.target.value)} />
            <span className="hint">Referencia técnica: no se suma al gasto del cliente.</span>
          </label>
          <div className="row">
            <label className="field grow">
              <span className="label">Producto vendido</span>
              <input className="input" value={draft.soldName} onChange={(e) => set("soldName", e.target.value)} />
            </label>
            <label className="field" style={{ width: 110 }}>
              <span className="label">Precio €</span>
              <input className="input" inputMode="decimal" value={draft.soldPrice} onChange={(e) => set("soldPrice", e.target.value)} />
            </label>
          </div>
        </div>
      </details>

      <section className="section">
        <div className="section-title">5 · Pago</div>
        <Segmented
          label="Pago"
          role="radiogroup"
          value={draft.payment}
          onChange={(v) => set("payment", v)}
          options={[
            { key: "registrado_en_local", label: "Pagado en el local" },
            { key: "pendiente", label: "Pendiente" },
          ]}
        />
        <span className="xs muted">Cerrar el servicio y cobrar son cosas distintas. La app no procesa pagos.</span>
      </section>

      {error && (
        <Notice tone="danger" icon="alert">
          {error}
        </Notice>
      )}
      <button className="btn primary block" onClick={submit} disabled={!draft.serviceIds.length || submitting}>
        Finalizar sesión
      </button>
    </div>
  );
}
