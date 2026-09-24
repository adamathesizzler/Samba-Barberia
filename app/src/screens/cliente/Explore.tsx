// 02 · Explorar y 03 · Detalle de look (diseño v1.0). Solo trabajos reales del local con permiso
// de portfolio (apartado 35): cada look enlaza a su barbero, servicios y precio actual.

import { useState } from "react";
import { back, navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { portfolioPhotos } from "../../domain/queries";
import { formatMoney } from "../../domain/time";
import type { DemoState, Photo, ServiceCategory } from "../../domain/types";
import { Icon } from "../../ui/Icon";
import { Empty, PageHeader, PhotoArt } from "../../ui/common";
import { haptic } from "../../ui/motion";

const FILTERS: { key: string; label: string; cats?: ServiceCategory[] }[] = [
  { key: "todos", label: "Todos" },
  { key: "corte", label: "Corte", cats: ["corte"] },
  { key: "degradado", label: "Degradado", cats: ["degradado"] },
  { key: "barba", label: "Barba", cats: ["barba"] },
  { key: "tinte", label: "Tinte", cats: ["color"] },
  { key: "trenzas", label: "Trenzas", cats: ["trenzas"] },
  { key: "cejas", label: "Cejas", cats: ["cejas"] },
  { key: "guardados", label: "Guardados" },
];

/** Nombre del look: el título que se le dio al cerrar la sesión, o sus servicios. */
function lookInfo(state: DemoState, p: Photo) {
  const session = state.sessions.find((s) => s.id === p.sessionId)!;
  const entry = state.styleEntries.find((e) => e.sessionId === session.id);
  const services = session.services.map((l) => state.services.find((s) => s.id === l.serviceId)).filter((s) => s && s.active) as DemoState["services"];
  return {
    session,
    title: entry?.title.replace(/ \(.*\)$/, "") ?? session.services.map((s) => s.name).join(" + "),
    staff: state.staff.find((s) => s.id === session.staffId)!,
    services,
    cats: services.map((s) => s.category),
  };
}

export function Explore() {
  const { state, actor, be } = useStore();
  const [filter, setFilter] = useState("todos");
  if (actor.kind !== "cliente") return null;
  const me = state.customers.find((c) => c.id === actor.customerId)!;
  const businessId = me.businessIds[0];
  const f = FILTERS.find((x) => x.key === filter)!;
  const seen = new Set<string>();
  const photos = portfolioPhotos(state, businessId).filter((p) => {
    if (seen.has(p.sessionId!)) return false;
    seen.add(p.sessionId!);
    if (filter === "guardados") return me.savedPhotoIds.includes(p.id);
    if (!f.cats) return true;
    return lookInfo(state, p).cats.some((c) => f.cats!.includes(c));
  });

  return (
    <div className="page">
      <PageHeader
        title="Explorar"
        action={
          <span className="icon-btn" aria-hidden="true" title="Búsqueda próximamente" style={{ opacity: 0.5 }}>
            <Icon name="search" />
          </span>
        }
      />
      <div className="chips" role="group" aria-label="Filtrar looks">
        {FILTERS.map((x) => (
          <button key={x.key} className="chip" aria-pressed={filter === x.key} onClick={() => setFilter(x.key)}>
            {x.key === "guardados" && <Icon name="heart" size={14} />} {x.label}
          </button>
        ))}
      </div>
      {photos.length === 0 ? (
        <Empty icon={filter === "guardados" ? "heart" : "compass"} title={filter === "guardados" ? "Aún no has guardado looks" : "No hay trabajos en esta categoría"}>
          {filter === "guardados" ? "Toca el corazón de un look para guardarlo aquí." : "Cuando haya fotos publicadas con permiso aparecerán aquí."}
        </Empty>
      ) : (
        <div className="explore-grid">
          {photos.map((p) => {
            const info = lookInfo(state, p);
            const saved = me.savedPhotoIds.includes(p.id);
            return (
              <div key={p.id} className="look-card" role="group" aria-label={info.title}>
                <PhotoArt hue={p.hue} view={p.view} img={p.img} label={null} />
                <button
                  style={{ position: "absolute", inset: 0, background: "none", border: 0 }}
                  aria-label={`Ver ${info.title}`}
                  onClick={(e) => navigate(`/cliente/explorar/${p.id}`, e.currentTarget.parentElement!.querySelector<HTMLElement>(".photo"))}
                />
                <button
                  className="glass-round save"
                  aria-pressed={saved}
                  aria-label={saved ? "Quitar de guardados" : "Guardar look"}
                  onClick={() => {
                    be.toggleSavedLook(actor, p.id);
                    if (!saved) haptic();
                  }}
                >
                  <Icon name="heart" size={16} />
                </button>
                <span className="name">
                  {info.title}
                  <Icon name="chevronRight" size={16} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ExploreDetail({ photoId }: { photoId: string }) {
  const { state, actor, be } = useStore();
  const base = state.photos.find((p) => p.id === photoId);
  const photo = base ? portfolioPhotos(state, base.businessId).find((p) => p.id === photoId) : undefined;
  const [shown, setShown] = useState(photoId);
  if (!photo || actor.kind !== "cliente")
    return (
      <div className="page">
        <PageHeader title="Look" backTo="/cliente/explorar" />
        <Empty icon="lock" title="Este look ya no está disponible">
          Puede que el cliente haya retirado la autorización de publicación.
        </Empty>
      </div>
    );
  const me = state.customers.find((c) => c.id === actor.customerId)!;
  const info = lookInfo(state, photo);
  const biz = state.businesses.find((b) => b.id === photo.businessId)!;
  // Precio y duración actuales del catálogo con este profesional, no lo que pagó ese cliente.
  const lines = info.services.map((s) => {
    const link = state.staffServices.find((l) => l.staffId === info.staff.id && l.serviceId === s.id);
    return { ...s, durationMin: link?.durationMin ?? s.durationMin, priceCents: link?.priceCents ?? s.priceCents };
  });
  const total = lines.reduce((a, s) => a + s.priceCents, 0);
  const dur = lines.reduce((a, s) => a + s.durationMin, 0);
  const fromPrice = lines.some((s) => s.priceKind === "desde");
  const saved = me.savedPhotoIds.includes(photo.id);
  const related = portfolioPhotos(state, photo.businessId, info.staff.id).slice(0, 4);
  if (!related.some((p) => p.id === photo.id)) related.unshift(photo);
  const current = state.photos.find((p) => p.id === shown) ?? photo;
  const bookUrl = (withRef: boolean) =>
    `/cliente/reservar?servicios=${lines.map((s) => s.id).join(",")}&profesional=${info.staff.id}${withRef ? `&ref=${photo.id}` : ""}`;

  return (
    <div className="page">
      <section className="look-hero">
        <PhotoArt key={current.id} className="swap-in" hue={current.hue} view={current.view} img={current.img} style={{ viewTransitionName: "foto" }} />
        <div className="top">
          <button className="glass-round" aria-label="Volver" onClick={() => back("/cliente/explorar")}>
            <Icon name="chevronLeft" />
          </button>
          <button
            className="glass-round"
            aria-pressed={saved}
            aria-label={saved ? "Quitar de guardados" : "Guardar look"}
            onClick={() => {
              be.toggleSavedLook(actor, photo.id);
              if (!saved) haptic();
            }}
            style={saved ? { background: "#fff", color: "#0b0b0c" } : undefined}
          >
            <Icon name="bookmark" size={18} />
          </button>
        </div>
        <div>
          <h1>{info.title}</h1>
          <p style={{ opacity: 0.8 }}>
            Por {info.staff.name} · {biz.name}
          </p>
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          {[...new Set(lines.map((s) => s.name))].map((n) => (
            <span key={n} className="chip-glass">
              {n}
            </span>
          ))}
          <span className="chip-glass">{dur} min</span>
        </div>
      </section>

      {related.length > 1 && (
        <div className="thumbs" role="group" aria-label="Más trabajos de este barbero">
          {related.slice(0, 4).map((p) => (
            <button key={p.id} aria-pressed={p.id === current.id} aria-label="Ver foto" onClick={() => setShown(p.id)}>
              <PhotoArt hue={p.hue} view={p.view} img={p.img} label={null} style={{ width: "100%", height: "100%" }} />
            </button>
          ))}
        </div>
      )}

      <button
        className="pill-cta"
        onClick={() => {
          haptic();
          navigate(bookUrl(true));
        }}
      >
        Quiero este look
        <span className="knob" aria-hidden="true">
          <Icon name="arrowRight" size={20} strokeWidth={2.2} />
        </span>
      </button>

      <section className="card included">
        <div className="row between" style={{ marginBottom: 6 }}>
          <b>Servicios incluidos</b>
          <span className="small muted">
            {dur} min · {fromPrice ? "desde " : ""}
            {formatMoney(total)}
          </span>
        </div>
        <ul>
          {lines.map((s) => (
            <li key={s.id}>
              <Icon name="checkCircle" size={18} /> {s.name}
              <span style={{ marginLeft: "auto" }}>
                {s.priceKind === "desde" ? "desde " : ""}
                {formatMoney(s.priceCents)}
              </span>
            </li>
          ))}
        </ul>
        <p className="xs muted" style={{ marginTop: 8 }}>
          {info.staff.name} adaptará el look a tu pelo.
        </p>
      </section>

      <div className="row">
        <button
          className="btn outline"
          aria-pressed={saved}
          onClick={() => {
            be.toggleSavedLook(actor, photo.id);
            if (!saved) haptic();
          }}
        >
          <Icon name="bookmark" size={18} /> {saved ? "Guardado" : "Guardar"}
        </button>
        <button className="btn primary grow" onClick={() => navigate(bookUrl(false))}>
          Reservar cita
        </button>
      </div>
    </div>
  );
}
