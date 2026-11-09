import { WEEKDAYS, WEEKDAY_NAMES, WEEKDAY_SHORT, WORK_WEEK, WEEKEND } from "../domain/constants";
import type { Weekday } from "../domain/types";

/** All state stores times as "HH:mm" (24h). "24:00" is allowed only as an end-of-day marker. */
const TIME_RE = /^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isValidTime = (t: string | undefined): t is string => !!t && TIME_RE.test(t);

/** "HH:mm" -> minutes from midnight. Returns NaN for invalid input. */
export function toMinutes(time: string): number {
  if (!isValidTime(time)) return NaN;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** minutes from midnight -> "HH:mm". 1440 -> "24:00". */
export function fromMinutes(total: number): string {
  const t = Math.max(0, Math.min(1440, Math.round(total)));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** "14:30" -> "2:30 PM". "24:00" -> "12:00 AM". */
export function formatTime(time: string): string {
  const total = toMinutes(time);
  if (Number.isNaN(total)) return time;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export const formatRange = (start: string, end: string) => `${formatTime(start)}–${formatTime(end)}`;

/** 90 -> "1h 30m", 45 -> "45m", 120 -> "2h", 0 -> "0m". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return "—";
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return `${r}m`;
}

export function sameDaySet(a: readonly Weekday[], b: readonly Weekday[]): boolean {
  return a.length === b.length && a.every(d => b.includes(d));
}

export const sortDays = (days: readonly Weekday[]): Weekday[] =>
  [...new Set(days)].sort((a, b) => a - b) as Weekday[];

/** "Tuesday, Wednesday", or "Every day" / "Weekdays" / "Weekends" for exact preset matches. */
export function formatDays(days: readonly Weekday[], style: "long" | "short" = "long"): string {
  const sorted = sortDays(days);
  if (!sorted.length) return "No days selected";
  if (sameDaySet(sorted, WEEKDAYS)) return "Every day";
  if (sameDaySet(sorted, WORK_WEEK)) return "Weekdays (Mon–Fri)";
  if (sameDaySet(sorted, WEEKEND)) return "Weekends (Sat–Sun)";
  const names = style === "long" ? WEEKDAY_NAMES : WEEKDAY_SHORT;
  return sorted.map(d => names[d]).join(", ");
}

// ---------- dates (all UTC-based so the result never depends on the machine's timezone) ----------

export function parseDate(date: string | undefined): Date | null {
  const m = date ? DATE_RE.exec(date) : null;
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  // Reject overflow such as 2026-02-31.
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
}

export const toDateString = (d: Date) => d.toISOString().slice(0, 10);
export const isValidDate = (date: string | undefined) => parseDate(date) !== null;

export function addDays(date: string, n: number): string {
  const d = parseDate(date);
  if (!d) return date;
  d.setUTCDate(d.getUTCDate() + n);
  return toDateString(d);
}

/** ISO weekday (Mon = 1 … Sun = 7) of a "YYYY-MM-DD" date, or null when invalid. */
export function weekdayOfDate(date: string | undefined): Weekday | null {
  const d = parseDate(date);
  if (!d) return null;
  return (d.getUTCDay() === 0 ? 7 : d.getUTCDay()) as Weekday;
}

/** Monday of the week containing `date`. */
export function mondayOf(date: string): string {
  const wd = weekdayOfDate(date);
  return wd ? addDays(date, 1 - wd) : date;
}

/** Local "today" as YYYY-MM-DD (uses the user's local calendar, not UTC). */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export const dateForWeekday = (weekStart: string, day: Weekday) => addDays(weekStart, day - 1);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatDate(date: string, withYear = true): string {
  const d = parseDate(date);
  if (!d) return date;
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return withYear ? `${base} ${d.getUTCFullYear()}` : base;
}

/** "9 Nov – 15 Nov 2026" */
export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const s = parseDate(weekStart), e = parseDate(end);
  if (!s || !e) return weekStart;
  return `${formatDate(weekStart, s.getUTCFullYear() !== e.getUTCFullYear())} – ${formatDate(end)}`;
}

export const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;
