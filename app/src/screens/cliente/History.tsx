// Historial por fecha y Mi estilo por intención (apartados 4, 5, 6, 7, 21).

import { useState } from "react";
import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { customerSessions, sessionPhotos } from "../../domain/queries";
import { formatDate, formatDay, formatMoney } from "../../domain/time";
import type { ServiceCategory } from "../../domain/types";
import { Icon } from "../../ui/Icon";
import { Empty, Notice, PageHeader, PhotoArt, Segmented, Sheet, SimBadge } from "../../ui/common";
import { BeforeAfterSlider, StyleCard, VisitRow } from "../../ui/product";
import { haptic, useParallax } from "../../ui/motion";

const STYLE_TABS: { key: string; label: string; cats?: ServiceCategory[] }[] = [
  { key: "favoritos", label: "Favoritos" },
  { key: "cortes", label: "Mis cortes", cats: ["corte", "degradado"] },
  { key: "barba", label: "Barba", cats: ["barba"] },
  { key: "color", label: "Color", cats: ["color"] },
  { key: "trenzas", label: "Trenzas", cats: ["trenzas"] },
  { key: "probar", label: "Quiero probar" },
];

export function History({ tab: initialTab }: { tab: string }) {
  const { state, actor } = useStore();
  const [tab, setTab] = useState<"visitas" | "estilo">(initialTab === "estilo" ? "estilo" : "visitas");
  const [styleTab, setStyleTab] = useState("favoritos");
  const [cat, setCat] = useState<string>("todo");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const heroRef = useParallax<HTMLDivElement>(0.45);
  if (actor.kind !== "cliente") return null;
  const sessions = customerSessions(state, actor.customerId);
  const entries = state.styleEntries.filter((e) => e.customerId === actor.customerId);

  const filteredSessions = sessions.filter(
    (s) => cat === "todo" || s.services.some((l) => state.services.find((x) => x.id === l.serviceId)?.category === cat) || (cat === "corte" && s.services.some((l) => l.name.toLowerCase().includes("corte"))),
  );

  const st = STYLE_TABS.find((t) => t.key === styleTab)!;
  const styleEntries = entries.filter((e) => {
    if (styleTab === "favoritos") return e.favorite;
    if (styleTab === "probar") return e.wantAgain;
    const session = state.sessions.find((s) => s.id === e.sessionId);
    return session?.services.some((l) => st.cats!.includes(state.services.find((x) => x.id === l.serviceId)?.category ?? "corte"));
  });

  const last = sessions[0];
  const lastEntry = last && entries.find((e) => e.sessionId === last.id);
  const heroPhoto = lastEntry?.coverPhotoId ? state.photos.find((p) => p.id === lastEntry.coverPhotoId) : undefined;
  const [day, month, year] = last ? formatDate(last.completedAt).split(" ") : [];

  return (
    <div className="page">
      {last && heroPhoto ? (
        <header className="fade-hero">
          <div className="parallax" ref={heroRef}>
            <PhotoArt hue={heroPhoto.hue} view={heroPhoto.view} img={heroPhoto.img} label={null} />
          </div>
          <div className="top-actions">
            <span className="glass-pill">{tab === "estilo" ? "Mis looks" : "Historial"}</span>
            <span className="glass-pill">{sessions.length} visitas</span>
          </div>
          <div className="big-date">
            <div className="xs muted" style={{ fontWeight: 600, letterSpacing: "0.04em", marginBottom: 6 }}>
              ÚLTIMA VISITA
            </div>
            {day} {month.slice(0, 3)} <span>{year}</span>
          </div>
          {lastEntry && (
            <button className="glass-pill" onClick={() => navigate(`/cliente/reservar?repetir=${lastEntry.id}`)}>
              Repetir <Icon name="sparkle" size={16} />
            </button>
          )}
        </header>
      ) : (
        <PageHeader title="Historial" />
      )}
      <Segmented
        label="Historial"
        value={tab}
        onChange={(t) => {
          setTab(t);
          history.replaceState(null, "", `#/cliente/historial?tab=${t}`);
        }}
        options={[
          { key: "visitas", label: "Visitas" },
          { key: "estilo", label: "Mi estilo" },
        ]}
      />

      {tab === "visitas" ? (
        <>
          <div className="chips" role="group" aria-label="Filtrar por servicio">
            {[
              ["todo", "Todo"],
              ["degradado", "Degradado"],
              ["corte", "Corte"],
              ["barba", "Barba"],
              ["color", "Color"],
            ].map(([k, l]) => (
              <button key={k} className="chip" aria-pressed={cat === k} onClick={() => setCat(k)}>
                {l}
              </button>
            ))}
          </div>
          {filteredSessions.length === 0 ? (
            <Empty icon="history" title={sessions.length ? "No hay visitas con este filtro" : "Aún no hay visitas"}>
              {sessions.length ? "Prueba con otro servicio." : "Cuando termines tu primera visita aparecerá aquí, con o sin fotos."}
            </Empty>
          ) : (
            <div className="list">
              {filteredSessions.map((s) => (
                <VisitRow key={s.id} session={s} onClick={() => navigate(`/cliente/visita/${s.id}`)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="row between">
            <div className="chips grow" role="group" aria-label="Colección">
              {STYLE_TABS.map((t) => (
                <button key={t.key} className="chip" aria-pressed={styleTab === t.key} onClick={() => setStyleTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row between">
            <span className="small muted">{styleEntries.length} estilos</span>
            <div style={{ width: 120 }}>
              <Segmented
                label="Vista"
                value={layout}
                onChange={setLayout}
                options={[
                  { key: "grid", label: <Icon name="grid" size={16} />, aria: "Cuadrícula" },
                  { key: "list", label: <Icon name="list" size={16} />, aria: "Lista" },
                ]}
              />
            </div>
          </div>
          {styleEntries.length === 0 ? (
            <Empty icon="heart" title="Nada por aquí todavía">
              {styleTab === "favoritos" ? "Marca como favorito un resultado desde su visita." : styleTab === "probar" ? "Marca «Quiero esto otra vez» en una visita para guardarlo aquí." : "Aún no hay resultados de este tipo."}
            </Empty>
          ) : layout === "grid" ? (
            <div className="grid-2">
              {styleEntries.map((e) => (
                <StyleCard key={e.id} entry={e} onClick={(el) => navigate(`/cliente/visita/${e.sessionId}`, el)} />
              ))}
            </div>
          ) : (
            <div className="list">
              {styleEntries.map((e) => (
                <VisitRow key={e.id} session={state.sessions.find((s) => s.id === e.sessionId)!} onClick={() => navigate(`/cliente/visita/${e.sessionId}`)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function VisitDetail({ id }: { id: string }) {
  const { state, actor, be, toast } = useStore();
  const [sheet, setSheet] = useState<null | "comparar" | "compartir">(null);
  const [liked, setLiked] = useState("");
  const [change, setChange] = useState("");
  const [photoIdx, setPhotoIdx] = useState(0);
  const session = state.sessions.find((s) => s.id === id);
  if (!session || actor.kind !== "cliente" || session.customerId !== actor.customerId)
    return (
      <div className="page">
        <PageHeader title="Visita" backTo="/cliente/historial" />
        <Empty icon="lock" title="No encontramos esta visita" />
      </div>
    );
  const entry = state.styleEntries.find((e) => e.sessionId === session.id)!;
  const staff = state.staff.find((s) => s.id === session.staffId)!;
  const biz = state.businesses.find((b) => b.id === session.businessId)!;
  const photos = sessionPhotos(state, session);
  const all = customerSessions(state, actor.customerId);
  const previous = all.slice(all.indexOf(session) + 1).find((s) => sessionPhotos(state, s).length > 0);
  const prevPhotos = previous ? sessionPhotos(state, previous) : [];
  const feedback = state.feedback.filter((f) => f.sessionId === session.id);
  const productsTotal = session.productsSold.reduce((a, p) => a + p.priceCents * p.qty, 0);
  const current = photos[photoIdx];

  return (
    <div className="page">
      <PageHeader
        title={entry?.title ?? "Visita"}
        backTo="/cliente/historial"
        action={
          entry && (
            <button className="icon-btn" aria-pressed={entry.favorite} aria-label={entry.favorite ? "Quitar de favoritos" : "Guardar como favorito"} onClick={() => {
                be.toggleFavorite(actor, entry.id);
                if (!entry.favorite) haptic();
              }} style={entry.favorite ? { background: "var(--selected)", color: "var(--on-selected)" } : undefined}>
              <Icon name="heart" />
            </button>
          )
        }
      />

      {photos.length ? (
        <div className="stack">
          <PhotoArt key={current.id} className="swap-in" hue={current.hue} view={current.view} img={current.img} source={current.source} style={{ aspectRatio: "4 / 5", borderRadius: "var(--r-xl)", viewTransitionName: photoIdx === 0 ? "foto" : undefined }} />
          {photos.length > 1 && (
            <div className="chips" role="tablist" aria-label="Fotos de la visita">
              {photos.map((p, i) => (
                <button key={p.id} role="tab" aria-selected={i === photoIdx} className="chip" aria-pressed={i === photoIdx} onClick={() => setPhotoIdx(i)}>
                  {{ frontal: "Frontal", lateral_izq: "Lateral izq.", lateral_der: "Lateral der.", posterior: "Posterior", detalle: "Detalle" }[p.view]}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Notice icon="camera">En esta visita no se hicieron fotos. El resto de datos se conserva igual.</Notice>
      )}

      <div className="card stack">
        <div className="row between">
          <span className="muted small">Fecha</span>
          <b>{formatDate(session.completedAt)}</b>
        </div>
        <div className="row between">
          <span className="muted small">Profesional</span>
          <b>
            {staff.name} · {biz.name}
          </b>
        </div>
        <div className="row between">
          <span className="muted small">Duración registrada</span>
          <b>{session.durationMin} min</b>
        </div>
        <hr className="divider" />
        {session.services.map((l) => (
          <div key={l.serviceId} className="row between">
            <span>{l.name}</span>
            <span>{formatMoney(l.priceCents)}</span>
          </div>
        ))}
        {session.finalCents !== session.estimatedCents && (
          <div className="row between small muted">
            <span>Ajuste confirmado en el local</span>
            <span>{formatMoney(session.finalCents - session.estimatedCents)}</span>
          </div>
        )}
        <div className="row between">
          <b>Importe del servicio</b>
          <b>{formatMoney(session.finalCents)}</b>
        </div>
        {productsTotal > 0 && (
          <div className="row between small">
            <span>Productos comprados: {session.productsSold.map((p) => `${p.name} ×${p.qty}`).join(", ")}</span>
            <span>{formatMoney(productsTotal)}</span>
          </div>
        )}
        <span className="xs muted">Pago {session.payment === "registrado_en_local" ? "registrado en el local" : "pendiente"}. El importe es el de ese día; si repites el estilo se usará el precio actual.</span>
        {session.corrections.length > 0 && <span className="xs muted">Corregido por {session.corrections.at(-1)!.by} el {formatDay(session.corrections.at(-1)!.at)}.</span>}
      </div>

      {session.maintenance && (
        <section className="card stack">
          <b>Cómo mantenerlo</b>
          <p className="small">{session.maintenance}</p>
          {session.productsUsed.length > 0 && <p className="xs muted">Producto utilizado en el servicio (referencia, no compra): {session.productsUsed.join(", ")}</p>}
        </section>
      )}

      <div className="grid-2">
        <button className="btn primary" onClick={() => navigate(`/cliente/reservar?repetir=${entry.id}`)}>
          <Icon name="repeat" size={18} /> Repetir
        </button>
        <button className="btn outline" onClick={() => be.toggleWantAgain(actor, entry.id)} aria-pressed={entry.wantAgain}>
          {entry.wantAgain ? <Icon name="check" size={18} /> : <Icon name="plus" size={18} />} Quiero esto otra vez
        </button>
        <button className="btn outline" disabled={!photos.length || !prevPhotos.length} onClick={() => setSheet("comparar")}>
          <Icon name="compare" size={18} /> Comparar
        </button>
        <button className="btn outline" disabled={!photos.length} onClick={() => setSheet("compartir")}>
          <Icon name="share" size={18} /> Compartir
        </button>
      </div>

      <section className="section">
        <div className="section-title">Esto me gusta / Esto no quiero repetir</div>
        {feedback.map((f) => (
          <div key={f.id} className="card tinted small stack tight">
            {f.liked && <span>👍 {f.liked}</span>}
            {f.change && <span>✎ {f.change}</span>}
            <span className="xs muted">
              {f.author === "cliente" ? "Tú" : "Profesional"} · {formatDay(f.at)}
            </span>
          </div>
        ))}
        <label className="field">
          <span className="label">Qué conservarías</span>
          <input className="input" value={liked} onChange={(e) => setLiked(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Qué cambiarías la próxima vez</span>
          <input className="input" value={change} onChange={(e) => setChange(e.target.value)} />
          <span className="hint">Es un comentario sobre esta visita: no se publica como reseña ni se convierte en una regla fija.</span>
        </label>
        <button
          className="btn outline block"
          disabled={!liked.trim() && !change.trim()}
          onClick={() => {
            be.addFeedback(actor, { customerId: actor.customerId, sessionId: session.id, kind: "comentario_visita", liked: liked.trim(), change: change.trim() });
            setLiked("");
            setChange("");
            toast("Guardado. Lo verás al preparar tu próxima visita.");
          }}
        >
          Guardar comentario
        </button>
      </section>

      {sheet === "comparar" && previous && (
        <Sheet title="Antes / Después" onClose={() => setSheet(null)}>
          <BeforeAfterSlider
            before={prevPhotos.find((p) => p.view === current.view) ?? prevPhotos[0]}
            after={current}
            beforeLabel={formatDay(previous.completedAt).split(" de ").slice(0, 2).join(" ")}
            afterLabel={formatDay(session.completedAt).split(" de ").slice(0, 2).join(" ")}
          />
          <p className="xs muted">Comparas resultados de dos visitas distintas, ambas fotografías reales guardadas en tu historial.</p>
        </Sheet>
      )}

      {sheet === "compartir" && (
        <Sheet title="Compartir" onClose={() => setSheet(null)}>
          <PhotoArt hue={current.hue} view={current.view} img={current.img} style={{ aspectRatio: "4 / 5", borderRadius: "var(--r-lg)", maxHeight: 300 }} />
          <p className="small">Se comparte solo esta imagen y el nombre del estilo. No se incluyen importes, notas ni el resto de tu historial.</p>
          <p className="xs muted">Compartir no autoriza a la barbería a usar la foto en publicidad. Eso se gestiona en Privacidad.</p>
          <button
            className="btn primary block"
            onClick={() => {
              setSheet(null);
              toast("Compartir imagen: simulado en el prototipo");
            }}
          >
            <Icon name="share" size={18} /> Compartir <SimBadge>demo</SimBadge>
          </button>
        </Sheet>
      )}
    </div>
  );
}
