import { useId, type ReactNode } from "react";
import { back } from "../app/router";
import type { AppointmentStatus, Photo, PhotoView } from "../domain/types";
import { Icon, type IconName } from "./Icon";

/**
 * Marcador de fotografía de demostración. El prototipo no usa fotos reales de personas:
 * dibuja una silueta y la etiqueta para que no se confunda con un resultado real.
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
  const side = view === "lateral_izq" ? -1 : view === "lateral_der" ? 1 : 0;
  const back = view === "posterior";
  const cx = 100 + side * 6;
  const tag = source === "simulacion_ia" ? "Simulación IA" : source === "referencia_externa" ? "Referencia externa" : label;
  return (
    <div className={`photo ${className}`} style={style}>
      <svg className="art" viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`bg${gid}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor={`hsl(${hue} 32% 74%)`} />
            <stop offset="1" stopColor={`hsl(${(hue + 30) % 360} 28% 38%)`} />
          </linearGradient>
          <linearGradient id={`sk${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`hsl(${(hue + 10) % 360} 30% 62%)`} />
            <stop offset="1" stopColor={`hsl(${(hue + 10) % 360} 26% 48%)`} />
          </linearGradient>
        </defs>
        <rect width="200" height="250" fill={`url(#bg${gid})`} />
        <path d="M30 250c6-46 36-66 70-66s64 20 70 66z" fill={`hsl(${hue} 18% 22%)`} opacity="0.9" />
        <rect x={cx - 15} y="150" width="30" height="40" rx="12" fill={`url(#sk${gid})`} />
        <ellipse cx={cx} cy="118" rx={side ? 36 : 40} ry="50" fill={`url(#sk${gid})`} />
        {side !== 0 && <ellipse cx={cx - side * 30} cy="122" rx="7" ry="11" fill={`hsl(${(hue + 10) % 360} 26% 52%)`} />}
        <path
          d={
            back
              ? `M${cx - 42} 125c-4-50 16-78 42-78s46 28 42 78c-6 24-18 40-42 40s-36-16-42-40z`
              : `M${cx - 41} 112c-2-40 18-62 41-62s43 22 41 62c-4-16-10-24-14-27-10 6-44 6-58-2-4 4-8 12-10 29z`
          }
          fill={`hsl(${hue} 22% 14%)`}
        />
        <path d={`M${cx - 40} 118c2 14 4 20 6 24M${cx + 40} 118c-2 14-4 20-6 24`} stroke={`hsl(${hue} 18% 26%)`} strokeWidth="6" strokeLinecap="round" opacity="0.5" />
        {!back && (
          <path d={`M${cx - 26} 140c8 26 44 26 52 0 0 20-10 34-26 34s-26-14-26-34z`} fill={`hsl(${hue} 22% 16%)`} opacity="0.85" />
        )}
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
