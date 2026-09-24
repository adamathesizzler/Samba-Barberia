// Perfil visual (apartado 3, R02), preferencias (8, 37), privacidad de fotos (20, 42) y ajustes.

import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { useTheme } from "../../App";
import { hasPhotoPermission } from "../../domain/permissions";
import { customerSessions, loyaltyProgress } from "../../domain/queries";
import { daysBetween, formatDay } from "../../domain/time";
import { Icon, type IconName } from "../../ui/Icon";
import { Notice, PageHeader, PhotoArt, Segmented, Switch } from "../../ui/common";
import { PreferenceChip } from "../../ui/product";
import { useCountUp, useParallax } from "../../ui/motion";

function Count({ to }: { to: number }) {
  return <>{useCountUp(to)}</>;
}

/** 05 · Perfil (diseño v1.0): pantalla oscura con foto, cifras, progreso y menú. */
export function Profile() {
  const { state, actor, now } = useStore();
  const heroPhoto = useParallax<HTMLDivElement>(0.4);
  if (actor.kind !== "cliente") return null;
  const me = state.customers.find((c) => c.id === actor.customerId)!;
  const sessions = customerSessions(state, me.id);
  const entries = state.styleEntries.filter((e) => e.customerId === me.id);
  const photos = state.photos.filter((p) => p.customerId === me.id && p.status === "subida" && p.sessionId);
  const coverId = entries.find((e) => e.favorite && e.coverPhotoId)?.coverPhotoId ?? photos[photos.length - 1]?.id;
  const cover = state.photos.find((p) => p.id === coverId);
  const preferred = state.staff.find((s) => s.id === me.preferredStaffId);
  const biz = state.businesses.find((b) => b.id === me.businessIds[0]);
  const first = sessions.at(-1);
  const loyalty = biz ? loyaltyProgress(state, me.id, biz.id) : null;
  const available = state.rewards.filter((r) => r.customerId === me.id && r.status === "disponible");
  const savedLooks = entries.filter((e) => e.favorite).length + me.savedPhotoIds.length;
  const months = first ? Math.max(0, Math.floor(daysBetween(first.completedAt, now) / 30.4)) : 0;
  const together = months >= 12 ? { n: Math.floor(months / 12), label: Math.floor(months / 12) === 1 ? "Año contigo" : "Años contigo" } : { n: months, label: months === 1 ? "Mes contigo" : "Meses contigo" };
  const pendingPrefs = state.preferences.filter((p) => p.customerId === me.id && !p.confirmed).length;

  const menu: { to?: string; icon: IconName; label: string; hint?: string; soon?: boolean; badge?: number }[] = [
    { to: "/cliente/looks", icon: "heart", label: "Mis looks", hint: "Favoritos, mis cortes, quiero probar" },
    { to: "/cliente/recompensas", icon: "gift", label: "Recompensas y logros", badge: available.length },
    { to: "/cliente/actividad", icon: "clock", label: "Mi actividad" },
    { to: "/cliente/preferencias", icon: "scissors", label: "Preferencias", badge: pendingPrefs },
    { to: "/cliente/privacidad", icon: "lock", label: "Privacidad y fotos" },
    { icon: "card", label: "Métodos de pago", soon: true },
    { to: "/cliente/espera", icon: "bell", label: "Notificaciones y lista de espera" },
    { to: "/cliente/ajustes", icon: "settings", label: "Ajustes" },
  ];

  return (
    <div className="theme-dark dark-screen">
      <div className="page">
        <section className="profile-hero" aria-label="Tu perfil" style={{ minHeight: 440 }}>
          <div className="parallax" ref={heroPhoto}>
            {cover ? (
              <PhotoArt hue={cover.hue} view={cover.view} label="Foto demo" />
            ) : (
              <div className="photo" style={{ background: `linear-gradient(160deg, hsl(${me.hue} 30% 60%), hsl(${me.hue} 25% 20%))` }} />
            )}
          </div>
          <div className="hero-actions" style={{ justifyContent: "flex-end" }}>
            <a className="glass-round" href="#/cliente/ajustes" aria-label="Ajustes">
              <Icon name="settings" />
            </a>
          </div>
          <div className="content" style={{ alignItems: "flex-start", textAlign: "left" }}>
            <h1>{me.name}</h1>
            <span className="muted">
              {biz?.name}
              {preferred ? ` · con ${preferred.name}` : ""}
            </span>
          </div>
        </section>

        <div className="stat-tiles">
          <div className="stat-tile">
            <b>
              <Count to={savedLooks} />
            </b>
            <span>Looks guardados</span>
          </div>
          <div className="stat-tile">
            <b>
              <Count to={sessions.length} />
            </b>
            <span>Citas realizadas</span>
          </div>
          <div className="stat-tile">
            <b>
              <Count to={together.n} />
            </b>
            <span>{together.label}</span>
          </div>
        </div>

        {loyalty && (
          <button className="progress-card" onClick={() => navigate("/cliente/recompensas")} aria-label="Tu progreso de recompensas">
            <div className="row between">
              <div>
                <div className="xs muted">Tu progreso</div>
                <div className="big">
                  {loyalty.inCycle}/{loyalty.program.goal}
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ color: "var(--loyalty)" }}>
                  <Icon name="crown" size={22} />
                </span>
                <div>
                  <div className="xs muted">{available.length ? "Recompensa disponible" : "Próxima recompensa"}</div>
                  <b className="small">{loyalty.program.rewardName.replace(" (demo)", "")}</b>
                </div>
              </div>
            </div>
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${(loyalty.inCycle / loyalty.program.goal) * 100}%` }} />
            </div>
          </button>
        )}

        <nav className="menu" aria-label="Tu cuenta">
          {menu.map((m) =>
            m.soon ? (
              <button key={m.label} disabled style={{ opacity: 0.6, cursor: "default" }}>
                <span className="ico">
                  <Icon name={m.icon} size={17} />
                </span>
                <span className="grow">{m.label}</span>
                <span className="soon">Próximamente</span>
              </button>
            ) : (
              <a key={m.label} href={`#${m.to}`}>
                <span className="ico">
                  <Icon name={m.icon} size={17} />
                </span>
                <span className="grow">
                  {m.label}
                  {m.hint && <div className="xs muted">{m.hint}</div>}
                </span>
                {!!m.badge && <span className="badge" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{m.badge}</span>}
                <Icon name="chevronRight" />
              </a>
            ),
          )}
        </nav>
        <p className="xs muted">
          Tu perfil es privado{first ? ` · cliente desde ${formatDay(first.completedAt).split(" de ").slice(1).join(" de ")}` : ""}. La app no cobra: el pago se hace en el local.
        </p>
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
