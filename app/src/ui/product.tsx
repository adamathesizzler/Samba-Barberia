// Componentes propios del producto (apartado 63). Reciben datos del estado; no contienen ejemplos propios.

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { navigate } from "../app/router";
import { useStore } from "../app/store";
import { totalDuration, totalPrice } from "../domain/availability";
import { datePart, formatDay, formatMoney, formatRelativeDay, timePart } from "../domain/time";
import type { Achievement, Appointment, Photo, Preference, Reward, Session, StyleEntry } from "../domain/types";
import { Icon } from "./Icon";
import { PhotoArt, ProgressBar, StatusBadge } from "./common";

export const priceText = (a: { services: { priceCents: number; priceKind: string }[] }) => {
  const total = totalPrice(a.services as never);
  return a.services.some((s) => s.priceKind === "desde") ? `desde ${formatMoney(total)}` : formatMoney(total);
};

/** Tarjeta de cita que cambia según el momento (apartado 14). */
export function AppointmentCard({ appt }: { appt: Appointment }) {
  const { state, now } = useStore();
  const staff = state.staff.find((s) => s.id === appt.staffId)!;
  const prep = state.preparations.find((p) => p.appointmentId === appt.id);
  const isToday = datePart(appt.start) === datePart(now);
  const services = appt.services.map((s) => s.name).join(" + ");

  let primary: { label: string; to: string; icon: "qr" | "sparkle" | "check" };
  if (appt.status === "llegada" || appt.status === "en_atencion") primary = { label: "Ver estado", to: `/cliente/cita/${appt.id}`, icon: "check" };
  else if (isToday) primary = { label: "Mostrar QR", to: `/cliente/pase/${appt.id}`, icon: "qr" };
  else primary = { label: prep ? "Revisar preparación" : "Preparar visita", to: `/cliente/preparar/${appt.id}`, icon: "sparkle" };

  return (
    <article className="card stack" aria-label="Próxima cita">
      <div className="row between">
        <span className="small muted">Próxima cita</span>
        <StatusBadge status={appt.status} />
      </div>
      <button className="stack tight" style={{ all: "unset", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }} onClick={() => navigate(`/cliente/cita/${appt.id}`)}>
        <span className="title-xl" style={{ fontSize: "var(--fs-2xl)" }}>
          {capitalize(formatRelativeDay(appt.start, now))} · {timePart(appt.start)}
        </span>
        <span className="muted">
          {services} con {staff.name}
        </span>
      </button>
      {appt.status === "llegada" && <p className="small">Te hemos registrado. {staff.name} te atenderá enseguida.</p>}
      {appt.status === "en_atencion" && <p className="small">Estás en atención con {staff.name}.</p>}
      <div className="row">
        <button className="btn primary grow" onClick={() => navigate(primary.to)}>
          <Icon name={primary.icon} size={18} /> {primary.label}
        </button>
        <button className="icon-btn" aria-label="Detalles de la reserva" onClick={() => navigate(`/cliente/cita/${appt.id}`)}>
          <Icon name="chevronRight" />
        </button>
      </div>
    </article>
  );
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ticket de confirmación (R01). El color de cabecera es de estado, no de marca. */
export function Ticket({ appt, children }: { appt: Appointment; children?: React.ReactNode }) {
  const { state } = useStore();
  const staff = state.staff.find((s) => s.id === appt.staffId)!;
  const loc = state.locations.find((l) => l.id === appt.locationId)!;
  const biz = state.businesses.find((b) => b.id === appt.businessId)!;
  const cancelled = appt.status === "cancelada";
  const done = appt.status === "completada";
  const heading = cancelled ? "Reserva cancelada" : done ? "Visita completada" : appt.status === "modificada" ? "Reserva modificada" : appt.status === "confirmada" ? "Reserva confirmada" : "Llegada registrada";
  return (
    <article className="ticket" aria-label={heading}>
      <div className={`ticket-head ${cancelled ? "cancelled" : done ? "done" : ""}`}>
        <span className="xs" style={{ opacity: 0.8, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
          {biz.name}
        </span>
        <h2 className="title-xl" style={{ fontSize: "var(--fs-2xl)" }}>
          {heading}
        </h2>
        <span className="code small" style={{ opacity: 0.85 }}>
          #{appt.code}
        </span>
      </div>
      <div className="ticket-body">
        <div className="kv">
          <div>
            <div className="k">Fecha</div>
            <div className="v">{capitalize(formatDay(appt.start))}</div>
          </div>
          <div>
            <div className="k">Hora</div>
            <div className="v">
              {timePart(appt.start)} – {timePart(appt.end)}
            </div>
          </div>
          <div>
            <div className="k">Servicios</div>
            <div className="v">{appt.services.map((s) => s.name).join(" + ")}</div>
          </div>
          <div>
            <div className="k">Duración · precio</div>
            <div className="v">
              {totalDuration(appt.services)} min · {priceText(appt)}
            </div>
          </div>
        </div>
        {appt.services.some((s) => s.priceKind === "desde") && (
          <p className="xs muted">Incluye servicios con precio «desde»: el importe final se confirma en el local antes de realizarlos.</p>
        )}
      </div>
      <div className="ticket-cut" />
      <div className="ticket-body">
        <div className="row">
          <span className="avatar" style={{ background: `hsl(${staff.hue} 35% 45%)` }} aria-hidden>
            {staff.name[0]}
          </span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{staff.name}</div>
            <div className="small muted">{staff.specialties.join(" · ")}</div>
          </div>
        </div>
        <div className="row">
          <span className="icon-btn" aria-hidden>
            <Icon name="map" />
          </span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{loc.name}</div>
            <div className="small muted">{loc.address}</div>
          </div>
        </div>
        {children}
      </div>
    </article>
  );
}

/** QR con token opaco: localiza la reserva, no contiene datos personales. */
export function CheckInQR({ token }: { token: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(`SAMBA-CHECKIN:${token}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } }).then(setSvg);
  }, [token]);
  return <div className="qr-box" role="img" aria-label="Código QR de la reserva" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function StyleCard({ entry, onClick }: { entry: StyleEntry; onClick: (photo: HTMLElement | null) => void }) {
  const { state } = useStore();
  const photo = entry.coverPhotoId ? state.photos.find((p) => p.id === entry.coverPhotoId) : undefined;
  const session = state.sessions.find((s) => s.id === entry.sessionId);
  return (
    <button onClick={(e) => onClick(e.currentTarget.querySelector<HTMLElement>(".photo"))} className="card clickable flat" style={{ padding: 0, overflow: "hidden" }} aria-label={entry.title}>
      {photo ? (
        <PhotoArt hue={photo.hue} view={photo.view} source={photo.source} style={{ aspectRatio: "4 / 5" }} />
      ) : (
        <div className="photo" style={{ aspectRatio: "4 / 5", display: "grid", placeItems: "center", color: "var(--text-3)" }}>
          <div className="stack tight" style={{ alignItems: "center" }}>
            <Icon name="camera" size={26} strokeWidth={1.4} />
            <span className="xs">Sin fotos</span>
          </div>
        </div>
      )}
      <div style={{ padding: "var(--s3)" }} className="stack tight">
        <div className="row between">
          <b className="small">{entry.title}</b>
          {entry.favorite && <Icon name="heart" size={14} label="Favorito" />}
        </div>
        {session && <span className="xs muted">{formatDay(session.completedAt)}</span>}
      </div>
    </button>
  );
}

export function VisitRow({ session, onClick }: { session: Session; onClick: () => void }) {
  const { state } = useStore();
  const staff = state.staff.find((s) => s.id === session.staffId);
  const biz = state.businesses.find((b) => b.id === session.businessId);
  const cover = session.photoIds.map((id) => state.photos.find((p) => p.id === id)).find((p) => p?.status === "subida");
  return (
    <button className="list-item" onClick={onClick}>
      {cover ? (
        <PhotoArt hue={cover.hue} view={cover.view} label={null} style={{ width: 52, height: 64, borderRadius: 12, flexShrink: 0 }} />
      ) : (
        <span className="photo" style={{ width: 52, height: 64, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0, color: "var(--text-3)" }}>
          <Icon name="scissors" size={18} />
        </span>
      )}
      <span className="grow stack tight">
        <b className="small">{session.services.map((s) => s.name).join(" + ")}</b>
        <span className="xs muted">
          {formatDay(session.completedAt)} · {staff?.name} · {session.durationMin} min
        </span>
        {biz && <span className="xs muted">{biz.name}</span>}
      </span>
      <b className="small">{formatMoney(session.finalCents)}</b>
    </button>
  );
}

/** Comparador Antes/Después con fechas visibles. Siempre compara imágenes reales guardadas. */
export function BeforeAfterSlider({ before, after, beforeLabel, afterLabel }: { before: Photo; after: Photo; beforeLabel: string; afterLabel: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const move = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div className="stack">
      <div
        ref={ref}
        className="compare"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && move(e.clientX)}
      >
        <PhotoArt hue={after.hue} view={after.view} label={null} />
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <PhotoArt hue={before.hue} view={before.view} label={null} />
        </div>
        <div className="handle" style={{ left: `${pos}%` }} />
        <span className="tag" style={{ left: 10 }}>
          Antes · {beforeLabel}
        </span>
        <span className="tag" style={{ right: 10 }}>
          Después · {afterLabel}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Deslizar comparación antes y después"
        style={{ width: "100%" }}
      />
    </div>
  );
}

export function RewardCard({ reward }: { reward: Reward }) {
  const tone = reward.status === "disponible" ? "loyalty" : reward.status === "caducada" ? "danger" : "";
  return (
    <article className="card stack" style={reward.status !== "disponible" ? { opacity: 0.7 } : undefined}>
      <div className="row between">
        <span className="row" style={{ gap: 8 }}>
          <Icon name="gift" />
          <b>{reward.name}</b>
        </span>
        <span className={`badge ${tone}`}>{reward.status === "disponible" ? "Disponible" : reward.status === "utilizada" ? "Utilizada" : "Caducada"}</span>
      </div>
      <p className="small">{reward.benefit}</p>
      <p className="xs muted">{reward.conditions}</p>
      <div className="row between xs muted">
        <span>Origen: {reward.origin}</span>
        <span>
          {reward.status === "utilizada" && reward.redeemedAt ? `Canjeada el ${formatDay(reward.redeemedAt)}` : `Vence el ${formatDay(reward.expiresAt)}`}
        </span>
      </div>
      {reward.status === "disponible" && (
        <div className="notice">
          <Icon name="qr" size={18} />
          <div>
            Para usarla, muestra este código en el local: <b className="code">{reward.redeemCode}</b>. El profesional comprueba que es tuya y que no se ha usado.
          </div>
        </div>
      )}
    </article>
  );
}

export function AchievementCard({ a, state, count, reachedAt }: { a: Achievement; state: "conseguido" | "en_progreso" | "bloqueado"; count: number; reachedAt?: string }) {
  return (
    <div className={`medal ${state}`}>
      <div className="hex">
        <Icon name={state === "conseguido" ? "star" : state === "bloqueado" ? "lock" : "scissors"} size={22} />
      </div>
      <b className="small">{a.name}</b>
      <span className="xs muted">{state === "conseguido" && reachedAt ? `Conseguido · ${formatDay(reachedAt).split(" de ").slice(0, 2).join(" ")}` : `${count} / ${a.threshold} visitas`}</span>
    </div>
  );
}

export function LoyaltyBlock({ inCycle, goal, rewardName }: { inCycle: number; goal: number; rewardName: string }) {
  const remaining = goal - inCycle;
  return (
    <div className="card stack" style={{ background: "var(--loyalty-bg)", borderColor: "transparent", boxShadow: "none" }}>
      <div className="row between">
        <b>Tu próximo premio</b>
        <span className="badge loyalty">
          {inCycle} / {goal} visitas
        </span>
      </div>
      <ProgressBar value={inCycle} max={goal} label={`${inCycle} de ${goal} visitas`} />
      <span className="small">
        {remaining === 1 ? "Te falta 1 visita" : `Te faltan ${remaining} visitas`} para: {rewardName}
      </span>
    </div>
  );
}

export function PreferenceChip({ pref }: { pref: Preference }) {
  return (
    <span className="chip" title={pref.confirmed ? "Confirmada" : "Propuesta, pendiente de confirmar"} style={!pref.confirmed ? { borderStyle: "dashed" } : undefined}>
      <span className="muted">{pref.label}:</span> {pref.value}
      {!pref.confirmed && <span className="xs muted">· propuesta</span>}
    </span>
  );
}
