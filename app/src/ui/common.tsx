import { useId, type ReactNode } from "react";
import { back } from "../app/router";
import type { AppointmentStatus, Photo, PhotoView } from "../domain/types";
import { Icon, type IconName } from "./Icon";

/**
 * Marcador de fotografía de demostración. El prototipo no usa fotos reales de personas:
 * dibuja un retrato de estudio en silueta (luz suave, niebla, borde iluminado) y lo etiqueta
 * para que no se confunda con un resultado real.
 */
export function PhotoArt({
  hue,
  view = "frontal",
  label = "Foto demo",
  source,
  className = "",
  style,
}: {
  hue: number;
  view?: PhotoView;
  label?: string | null;
  source?: Photo["source"];
  className?: string;
  style?: React.CSSProperties;
}) {
  const gid = useId().replace(/:/g, "");
  const tag = source === "simulacion_ia" ? "Simulación IA" : source === "referencia_externa" ? "Referencia externa" : label;
  // Variante de corte según el tono: rapado con volumen, texturizado o rizado.
  const cut = Math.abs(Math.round(hue)) % 3;
  const bgTop = `hsl(${hue} 42% 74%)`;
  const bgBottom = `hsl(${(hue + 25) % 360} 36% 36%)`;
  const ink = `hsl(${hue} 18% 11%)`;
  const rim = `hsl(${(hue + 30) % 360} 60% 88%)`;
  const lateral = view === "lateral_izq" || view === "lateral_der";
  const flip = view === "lateral_izq" ? "translate(200 0) scale(-1 1)" : undefined;
  const zoom = view === "detalle" ? "translate(-110 -40) scale(1.9)" : undefined;

  const hair =
    cut === 0
      ? "M80 104 C74 70 98 50 128 52 C148 54 158 68 154 86 C142 76 124 74 108 80 C96 86 90 96 88 110 Z"
      : cut === 1
        ? "M78 108 C70 74 90 46 126 46 C142 44 156 52 158 64 C150 62 152 72 158 80 C144 74 124 72 106 80 C94 86 88 98 86 112 Z"
        : "M76 110 C66 90 72 58 98 50 C104 42 118 40 126 46 C136 40 150 46 150 56 C160 60 162 76 154 84 C140 76 122 74 106 80 C94 86 88 98 86 112 Z";

  return (
    <div className={`photo ${className}`} style={style}>
      <svg className="art" viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`bg${gid}`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor={bgTop} />
            <stop offset="1" stopColor={bgBottom} />
          </linearGradient>
          <radialGradient id={`glow${gid}`} cx="0.72" cy="0.28" r="0.6">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`fog${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.55" stopColor={bgBottom} stopOpacity="0" />
            <stop offset="1" stopColor={bgBottom} stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`fade${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={ink} stopOpacity="0" />
            <stop offset="1" stopColor={ink} stopOpacity="0.35" />
          </linearGradient>
          <filter id={`soft${gid}`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.9" />
          </filter>
        </defs>
        <rect width="200" height="250" fill={`url(#bg${gid})`} />
        <rect width="200" height="250" fill={`url(#glow${gid})`} />
        <g transform={zoom}>
          <g transform={flip} filter={`url(#soft${gid})`}>
            {lateral ? (
              <>
                {/* Perfil: nuca, frente, nariz, labios, mentón y hombros */}
                <path
                  d="M80 150 C70 128 68 100 80 82 C92 64 116 58 134 66 C146 72 150 86 148 98 L155 112 L148 116 C150 121 150 125 146 128 C149 134 146 140 140 144 C134 148 128 150 124 154 L127 176 C152 184 172 198 180 250 L18 250 C24 206 50 190 76 180 C80 172 81 160 80 150 Z"
                  fill={ink}
                />
                <path d={hair} fill={ink} />
                {/* Degradado del lateral: la zona rapada se ve más clara */}
                <path d="M82 112 C80 128 82 140 86 150 L112 148 C108 134 104 120 102 108 Z" fill={`url(#fade${gid})`} opacity="0.9" />
                <path d="M80 150 C70 128 68 100 80 82 C92 64 116 58 134 66" fill="none" stroke={rim} strokeWidth="1.4" opacity="0.8" />
              </>
            ) : (
              <>
                <path d="M100 176 C130 178 170 196 178 250 L22 250 C30 196 70 178 100 176 Z" fill={ink} />
                <path d="M86 150 L86 180 L114 180 L114 150 Z" fill={ink} />
                <ellipse cx="100" cy="116" rx="36" ry="46" fill={ink} />
                <ellipse cx="64" cy="118" rx="6" ry="10" fill={ink} />
                <ellipse cx="136" cy="118" rx="6" ry="10" fill={ink} />
                <path
                  d={
                    cut === 0
                      ? "M62 112 C58 72 78 58 100 58 C124 58 144 72 138 112 C132 92 118 84 100 84 C82 84 68 92 62 112 Z"
                      : cut === 1
                        ? "M62 110 C56 66 80 50 104 52 C128 52 146 70 138 110 C134 90 126 80 116 76 C104 84 84 84 74 88 C68 94 64 102 62 110 Z"
                        : "M60 112 C52 84 62 56 86 52 C94 44 110 44 118 50 C132 48 146 60 144 78 C150 90 144 104 140 112 C134 94 118 86 100 86 C82 86 66 94 60 112 Z"
                  }
                  fill={ink}
                />
                {view !== "posterior" && (
                  <path d="M86 138 C92 146 108 146 114 138" fill="none" stroke={rim} strokeWidth="1" opacity="0.35" />
                )}
                <path d="M64 112 C62 80 80 60 100 60 C120 60 138 80 136 112" fill="none" stroke={rim} strokeWidth="1.3" opacity="0.7" />
              </>
            )}
          </g>
        </g>
        <rect width="200" height="250" fill={`url(#fog${gid})`} />
      </svg>
      {tag && <span className="demo-tag">{tag}</span>}
    </div>
  );
}

export function Avatar({ name, hue, size = "md" }: { name: string; hue: number; size?: "md" | "lg" }) {
  return (
    <span className={`avatar ${size === "lg" ? "lg" : ""}`} style={{ background: `linear-gradient(150deg, hsl(${hue} 35% 55%), hsl(${(hue + 40) % 360} 35% 32%))` }} aria-hidden="true">
      {name.trim()[0]?.toUpperCase()}
    </span>
  );
}

const STATUS: Record<AppointmentStatus, { label: string; tone: string; icon: IconName }> = {
  confirmada: { label: "Confirmada", tone: "success", icon: "check" },
  modificada: { label: "Modificada", tone: "warning", icon: "info" },
  cancelada: { label: "Cancelada", tone: "danger", icon: "x" },
  llegada: { label: "Llegada registrada", tone: "success", icon: "check" },
  en_atencion: { label: "En atención", tone: "warning", icon: "scissors" },
  completada: { label: "Completada", tone: "", icon: "check" },
  ausencia: { label: "Ausencia", tone: "danger", icon: "alert" },
};

/** Estado con texto e icono: nunca depende solo del color. */
export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const s = STATUS[status];
  return (
    <span className={`badge ${s.tone}`}>
      <Icon name={s.icon} size={12} strokeWidth={2.4} />
      {s.label}
    </span>
  );
}

export const statusLabel = (s: AppointmentStatus) => STATUS[s].label;

export function SimBadge({ children = "Simulado" }: { children?: ReactNode }) {
  return <span className="badge sim">{children}</span>;
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  if (max <= 12)
    return (
      <div className="progress segments" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < value ? "on" : ""} />
        ))}
      </div>
    );
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty card flat">
      <Icon name={icon} size={32} strokeWidth={1.4} />
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = "info", icon = "info", children }: { tone?: "info" | "success" | "warning" | "danger"; icon?: IconName; children: ReactNode }) {
  return (
    <div className={`notice ${tone === "info" ? "" : tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}

export function PageHeader({ title, backTo, action }: { title: string; backTo?: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      {backTo && (
        <button className="icon-btn" onClick={() => back(backTo)} aria-label="Volver">
          <Icon name="chevronLeft" />
        </button>
      )}
      <h1>{title}</h1>
      {action}
    </header>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2 style={{ fontSize: "var(--fs-lg)" }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="row between" style={{ minHeight: "var(--tap)" }}>
      <span className="grow">{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />
    </label>
  );
}
