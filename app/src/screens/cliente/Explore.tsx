// Explorar estilos (apartado 35): solo trabajos con autorización de portfolio.

import { useState } from "react";
import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { portfolioPhotos } from "../../domain/queries";
import { formatMoney } from "../../domain/time";
import type { ServiceCategory } from "../../domain/types";
import { Icon } from "../../ui/Icon";
import { Empty, PageHeader, PhotoArt, SimBadge } from "../../ui/common";

const FILTERS: { key: string; label: string; cats?: ServiceCategory[] }[] = [
  { key: "todo", label: "Todo" },
  { key: "cortes", label: "Cortes", cats: ["corte"] },
  { key: "fade", label: "Fade / Degradados", cats: ["degradado"] },
  { key: "barba", label: "Barba", cats: ["barba"] },
  { key: "trenzas", label: "Trenzas", cats: ["trenzas"] },
  { key: "color", label: "Color", cats: ["color"] },
];

export function Explore() {
  const { state, actor } = useStore();
  const [filter, setFilter] = useState("todo");
  if (actor.kind !== "cliente") return null;
  const me = state.customers.find((c) => c.id === actor.customerId)!;
  const businessId = me.businessIds[0];
  const f = FILTERS.find((x) => x.key === filter)!;
  const photos = portfolioPhotos(state, businessId).filter((p) => {
    if (!f.cats) return true;
    const session = state.sessions.find((s) => s.id === p.sessionId);
    return session?.services.some((l) => f.cats!.includes(state.services.find((s) => s.id === l.serviceId)?.category ?? "corte"));
  });

  return (
    <div className="page">
      <PageHeader title="Explorar" />
      <p className="small muted">Trabajos reales de {state.businesses.find((b) => b.id === businessId)?.name}, publicados con permiso de cada cliente.</p>
      <div className="chips" role="group" aria-label="Filtrar estilos">
        {FILTERS.map((x) => (
          <button key={x.key} className="chip" aria-pressed={filter === x.key} onClick={() => setFilter(x.key)}>
            {x.label}
          </button>
        ))}
        <button className="chip" disabled title="Necesita un criterio real antes de mostrarse">
          Tendencias · pronto
        </button>
      </div>
      {photos.length === 0 ? (
        <Empty icon="compass" title="Aún no hay trabajos publicados">
          Cuando haya fotos autorizadas en esta categoría aparecerán aquí.
        </Empty>
      ) : (
        <div className="grid-photos">
          {photos.map((p) => (
            <button key={p.id} onClick={() => navigate(`/cliente/explorar/${p.id}`)} aria-label="Ver trabajo">
              <PhotoArt hue={p.hue} view={p.view} label={null} style={{ width: "100%", height: "100%" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExploreDetail({ photoId }: { photoId: string }) {
  const { state } = useStore();
  const photo = portfolioPhotos(state, state.photos.find((p) => p.id === photoId)?.businessId ?? "").find((p) => p.id === photoId);
  if (!photo)
    return (
      <div className="page">
        <PageHeader title="Trabajo" backTo="/cliente/explorar" />
        <Empty icon="lock" title="Este trabajo ya no está disponible">
          Puede que el cliente haya retirado la autorización de publicación.
        </Empty>
      </div>
    );
  const session = state.sessions.find((s) => s.id === photo.sessionId)!;
  const staff = state.staff.find((s) => s.id === session.staffId)!;
  const biz = state.businesses.find((b) => b.id === photo.businessId)!;
  // Precio actual del catálogo, no el que pagó ese cliente.
  const current = session.services.map((l) => state.services.find((s) => s.id === l.serviceId)!).filter(Boolean);
  const total = current.reduce((a, s) => a + s.priceCents, 0);
  const fromPrice = current.some((s) => s.priceKind === "desde");
  const dur = current.reduce((a, s) => a + s.durationMin, 0);

  return (
    <div className="page">
      <PageHeader title="Trabajo" backTo="/cliente/explorar" />
      <PhotoArt hue={photo.hue} view={photo.view} style={{ aspectRatio: "4 / 5", borderRadius: "var(--r-xl)" }} />
      <div className="stack tight">
        <h2 style={{ fontSize: "var(--fs-xl)" }}>{current.map((s) => s.name).join(" + ")}</h2>
        <span className="muted small">
          {staff.name} · {biz.name}
        </span>
      </div>
      <div className="card tinted row between">
        <span className="small">Precio actual orientativo</span>
        <b>
          {fromPrice ? "desde " : ""}
          {formatMoney(total)} · {dur} min
        </b>
      </div>
      <div className="stack">
        <button
          className="btn primary block"
          onClick={() => navigate(`/cliente/reservar?servicios=${current.map((s) => s.id).join(",")}&profesional=${staff.id}&ref=${photo.id}`)}
        >
          Reservar este estilo con {staff.name}
        </button>
        <button className="btn outline block" onClick={() => navigate(`/cliente/style-ai`)}>
          <Icon name="sparkle" size={18} /> Probar con IA <SimBadge>Fase 3</SimBadge>
        </button>
      </div>
      <p className="xs muted">
        Usarlo como referencia no garantiza el mismo resultado: tu barbero confirmará qué adaptación necesitas.
      </p>
    </div>
  );
}
