// Perfil visual (apartado 3, R02), preferencias (8, 37), privacidad de fotos (20, 42) y ajustes.

import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { useTheme } from "../../App";
import { hasPhotoPermission } from "../../domain/permissions";
import { customerSessions, upcomingAppointments } from "../../domain/queries";
import { formatDay } from "../../domain/time";
import { Icon, type IconName } from "../../ui/Icon";
import { Empty, Notice, PageHeader, PhotoArt, Segmented, Switch } from "../../ui/common";
import { PreferenceChip } from "../../ui/product";
import { useCountUp, useParallax } from "../../ui/motion";

function Count({ to }: { to: number }) {
  return <>{useCountUp(to)}</>;
}

export function Profile() {
  const { state, actor, now } = useStore();
  const heroPhoto = useParallax<HTMLDivElement>(0.4);
  if (actor.kind !== "cliente") return null;
  const me = state.customers.find((c) => c.id === actor.customerId)!;
  const sessions = customerSessions(state, me.id);
  const entries = state.styleEntries.filter((e) => e.customerId === me.id);
  const rewards = state.rewards.filter((r) => r.customerId === me.id);
  const photos = state.photos.filter((p) => p.customerId === me.id && p.status === "subida" && p.sessionId);
  const coverId = entries.find((e) => e.favorite && e.coverPhotoId)?.coverPhotoId ?? photos[photos.length - 1]?.id;
  const cover = state.photos.find((p) => p.id === coverId);
  const preferred = state.staff.find((s) => s.id === me.preferredStaffId);
  const biz = state.businesses.find((b) => b.id === me.businessIds[0]);
  const prefs = state.preferences.filter((p) => p.customerId === me.id && p.confirmed);
  const first = sessions.at(-1);
  const next = upcomingAppointments(state, me.id, now)[0];

  const links: { to: string; icon: IconName; label: string; hint?: string }[] = [
    { to: "/cliente/recompensas", icon: "gift", label: "Recompensas y logros" },
    { to: "/cliente/actividad", icon: "euro", label: "Mi actividad", hint: "Gasto y visitas, solo para ti" },
    { to: "/cliente/preferencias", icon: "scissors", label: "Preferencias y cómo quiero mi sesión" },
    { to: "/cliente/privacidad", icon: "lock", label: "Privacidad y fotos" },
    { to: "/cliente/espera", icon: "bell", label: "Lista de espera" },
    { to: "/cliente/ajustes", icon: "settings", label: "Ajustes" },
  ];

  return (
    <div className="page">
      <section className="profile-hero" aria-label="Tu perfil">
        <div className="parallax" ref={heroPhoto}>
          {cover ? (
            <PhotoArt hue={cover.hue} view={cover.view} label="Foto demo" />
          ) : (
            <div className="photo" style={{ background: `linear-gradient(160deg, hsl(${me.hue} 30% 80%), hsl(${me.hue} 25% 45%))` }} />
          )}
        </div>
        <div className="hero-actions">
          <a className="glass-round" href="#/cliente/ajustes" aria-label="Ajustes">
            <Icon name="settings" />
          </a>
          <a className="glass-round" href="#/cliente/privacidad" aria-label="Privacidad y fotos">
            <Icon name="lock" />
          </a>
        </div>
        <div className="content">
          <div className="stack tight" style={{ alignItems: "center" }}>
            <h1>{me.name}</h1>
            <span className="muted">
              {biz?.name}
              {preferred ? ` · con ${preferred.name}` : ""}
            </span>
          </div>
          <div className="row" style={{ width: "100%" }}>
            <button className="btn primary grow" style={{ minHeight: 52 }} onClick={() => navigate("/cliente/reservar")}>
              Reservar
            </button>
            <button
              className="icon-btn"
              style={{ width: 52, height: 52, border: "1px solid var(--border)", background: "var(--glass)" }}
              aria-label={next ? "Mostrar QR de tu próxima cita" : "Lista de espera"}
              onClick={() => navigate(next ? `/cliente/pase/${next.id}` : "/cliente/espera")}
            >
              <Icon name={next ? "qr" : "bell"} />
            </button>
          </div>
          <div className="profile-stats">
            <div className="stat">
              <b>
                <Count to={sessions.length} />
              </b>
              <span>visitas</span>
            </div>
            <div className="stat">
              <b>
                <Count to={entries.filter((e) => e.coverPhotoId).length} />
              </b>
              <span>estilos</span>
            </div>
            <div className="stat">
              <b>
                <Count to={rewards.length} />
              </b>
              <span>recompensas</span>
            </div>
          </div>
          <div className="bio glass">
            {prefs.length ? prefs.map((p) => `${p.label}: ${p.value.toLowerCase()}`).join(" · ") : "Aún no has guardado preferencias de estilo."}
            {first && <div className="xs muted" style={{ marginTop: 4 }}>Cliente desde {formatDay(first.completedAt).split(" de ").slice(1).join(" de ")}</div>}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          Mi colección
          <a href="#/cliente/historial?tab=estilo" className="section-count" style={{ textDecoration: "none" }}>
            {photos.length} fotos
          </a>
        </div>
        {photos.length === 0 ? (
          <Empty icon="camera" title="Tu colección empieza en tu primera visita">
            Tu barbero podrá añadir fotos del resultado. Son privadas salvo que autorices otra cosa.
          </Empty>
        ) : (
          <div className="grid-photos">
            {photos
              .slice()
              .reverse()
              .slice(0, 9)
              .map((p) => (
                <button key={p.id} aria-label="Abrir visita" onClick={(e) => navigate(`/cliente/visita/${p.sessionId}`, e.currentTarget.querySelector<HTMLElement>(".photo"))}>
                  <PhotoArt hue={p.hue} view={p.view} label={null} style={{ width: "100%", height: "100%" }} />
                </button>
              ))}
          </div>
        )}
        <p className="xs muted">Tu perfil es privado: aunque se parezca a una red social, ningún otro cliente puede verlo.</p>
      </section>

      <div className="list">
        {links.map((l) => (
          <a key={l.to} className="list-item" href={`#${l.to}`}>
            <Icon name={l.icon} />
            <span className="grow">
              {l.label}
              {l.hint && <div className="xs muted">{l.hint}</div>}
            </span>
            <Icon name="chevronRight" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function Preferences() {
  const { state, actor, be } = useStore();
  if (actor.kind !== "cliente") return null;
  const me = state.customers.find((c) => c.id === actor.customerId)!;
  const prefs = state.preferences.filter((p) => p.customerId === me.id);
  const pending = prefs.filter((p) => !p.confirmed);
  const s = me.sessionStyle;
  return (
    <div className="page">
      <PageHeader title="Preferencias" backTo="/cliente/perfil" />
      <section className="section">
        <div className="section-title">Mi estilo habitual</div>
        <div className="chips" style={{ flexWrap: "wrap" }}>
          {prefs.filter((p) => p.confirmed).map((p) => (
            <PreferenceChip key={p.id} pref={p} />
          ))}
        </div>
        {pending.map((p) => (
          <div key={p.id} className="card stack">
            <span className="small">
              Tu barbero propone guardar: <b>{p.label}: {p.value}</b>
            </span>
            <div className="row">
              <button className="btn primary sm" onClick={() => be.confirmPreference(actor, p.id, true)}>
                Confirmar
              </button>
              <button className="btn outline sm" onClick={() => be.confirmPreference(actor, p.id, false)}>
                No, gracias
              </button>
            </div>
          </div>
        ))}
        <p className="xs muted">Una propuesta no se trata como preferencia tuya hasta que la confirmas.</p>
      </section>
      <section className="section card">
        <div className="section-title">Cómo quiero mi sesión</div>
        <Switch label="Prefiero una sesión tranquila" checked={s.tranquila} onChange={(v) => be.setSessionStyle(actor, { ...s, tranquila: v })} />
        <Switch label="Me gusta que me expliquen los cambios" checked={s.explicarCambios} onChange={(v) => be.setSessionStyle(actor, { ...s, explicarCambios: v })} />
        <Switch label="Quiero consultar antes de cambios importantes" checked={s.consultarAntes} onChange={(v) => be.setSessionStyle(actor, { ...s, consultarAntes: v })} />
        <p className="xs muted">Puedes cambiarlo cuando quieras, sin dar explicaciones.</p>
      </section>
    </div>
  );
}

export function Privacy() {
  const { state, actor, be } = useStore();
  if (actor.kind !== "cliente") return null;
  const photos = state.photos.filter((p) => p.customerId === actor.customerId && p.status === "subida" && p.sessionId).slice().reverse();
  return (
    <div className="page">
      <PageHeader title="Privacidad y fotos" backTo="/cliente/perfil" />
      <Notice icon="lock">
        Tus fotos se guardan en tu historial privado. Publicarlas en el portfolio del local es una autorización aparte, foto a foto, y puedes retirarla. Retirarla no borra copias que otros hayan hecho fuera de la app.
      </Notice>
      <Notice icon="info">
        Si compartes una referencia con otra barbería, solo verá esa imagen para esa cita: no tus precios, tu gasto ni tus notas.
      </Notice>
      <div className="list">
        {photos.map((p) => {
          const session = state.sessions.find((s) => s.id === p.sessionId)!;
          const on = hasPhotoPermission(state, p.id, "portfolio");
          return (
            <div key={p.id} className="list-item">
              <PhotoArt hue={p.hue} view={p.view} label={null} style={{ width: 44, height: 56, borderRadius: 10, flexShrink: 0 }} />
              <span className="grow small">
                {formatDay(session.completedAt)}
                <div className="xs muted">{state.businesses.find((b) => b.id === p.businessId)?.name}</div>
              </span>
              <span className="xs muted">Portfolio</span>
              <button role="switch" aria-checked={on} aria-label="Permitir en el portfolio del local" className="switch" onClick={() => be.setPhotoPermission(actor, p.id, "portfolio", !on)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Settings() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="page">
      <PageHeader title="Ajustes" backTo="/cliente/perfil" />
      <section className="section">
        <div className="section-title">Tema</div>
        <Segmented
          label="Tema"
          role="radiogroup"
          value={theme}
          onChange={setTheme}
          options={[
            { key: "system", label: "Sistema" },
            { key: "light", label: "Claro" },
            { key: "dark", label: "Oscuro" },
          ]}
        />
      </section>
      <button className="btn outline block" onClick={() => navigate("/cliente/bienvenida")}>
        Ver la bienvenida
      </button>
      <section className="section card">
        <div className="section-title">Avisos</div>
        <p className="small muted">Recordatorios de cita, seguimiento y promociones irán por separado y con tu permiso. En este prototipo no se envía ninguna notificación real.</p>
      </section>
      <section className="section card">
        <div className="section-title">Música para la cita</div>
        <p className="small muted">My Session (Spotify / Apple Music) es un experimento futuro. No está conectado.</p>
      </section>
    </div>
  );
}
