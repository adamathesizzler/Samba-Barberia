// Utilidades de fecha sin zona horaria: el prototipo trabaja en hora local del establecimiento.

const pad = (n: number) => String(n).padStart(2, "0");

export function toLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseLocal(s: string): Date {
  const [date, time = "00:00"] = s.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export function addMinutes(s: string, min: number): string {
  const d = parseLocal(s);
  d.setMinutes(d.getMinutes() + min);
  return toLocal(d);
}

export function addDays(s: string, days: number): string {
  const d = parseLocal(s);
  d.setDate(d.getDate() + days);
  return toLocal(d);
}

export const datePart = (s: string) => s.slice(0, 10);
export const timePart = (s: string) => s.slice(11, 16);

export function minutesBetween(a: string, b: string): number {
  return Math.round((parseLocal(b).getTime() - parseLocal(a).getTime()) / 60000);
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function daysBetween(a: string, b: string): number {
  const da = parseLocal(datePart(a) + "T00:00");
  const db = parseLocal(datePart(b) + "T00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function formatDay(s: string): string {
  const d = parseLocal(s);
  return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function formatDate(s: string): string {
  const d = parseLocal(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatRelativeDay(s: string, now: string): string {
  const diff = daysBetween(now, s);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff > 1 && diff < 7) return DAYS[parseLocal(s).getDay()];
  return formatDay(s);
}

export const weekday = (s: string) => parseLocal(s).getDay();

export function formatMoney(cents: number): string {
  const v = cents / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(".", ",")} €`;
}
