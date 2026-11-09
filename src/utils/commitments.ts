import type { FixedCommitment, Weekday } from "../domain/types";
import { WEEKDAYS } from "../domain/constants";
import { WEEKDAY_NAMES } from "../domain/constants";
import { addDays, dateForWeekday, formatDate, formatDays, formatRange, toMinutes, weekdayOfDate } from "./timeUtils";

export interface CommitmentOccurrence {
  commitmentId: string;
  title: string;
  day: Weekday;
  date: string;
  startTime: string;
  endTime: string;
  startMinute: number;
  endMinute: number;
  recurrence: "weekly" | "once";
}

/** Does this commitment apply to `day` of the week starting at `weekStart`? */
export function appliesOn(c: FixedCommitment, day: Weekday, weekStart: string): boolean {
  if (c.recurrence === "weekly") return c.days.includes(day);
  return c.date === dateForWeekday(weekStart, day);
}

/** True when a one-off commitment's date lies inside the planning week. */
export function onceIsInWeek(c: FixedCommitment, weekStart: string): boolean {
  if (c.recurrence !== "once" || !c.date) return false;
  return c.date >= weekStart && c.date <= addDays(weekStart, 6) && weekdayOfDate(c.date) !== null;
}

/**
 * Expand commitments into concrete occurrences for one planning week.
 * A weekly commitment on Tue + Wed yields two occurrences; a one-off yields one (or none
 * if its date is outside the week). Stored data is never duplicated.
 */
export function expandCommitments(commitments: readonly FixedCommitment[], weekStart: string): CommitmentOccurrence[] {
  const out: CommitmentOccurrence[] = [];
  for (const c of commitments) {
    const s = toMinutes(c.startTime), e = toMinutes(c.endTime);
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) continue;
    for (const day of WEEKDAYS) {
      if (!appliesOn(c, day, weekStart)) continue;
      out.push({
        commitmentId: c.id, title: c.title, day, date: dateForWeekday(weekStart, day),
        startTime: c.startTime, endTime: c.endTime, startMinute: s, endMinute: e, recurrence: c.recurrence,
      });
    }
  }
  return out.sort((a, b) => a.day - b.day || a.startMinute - b.startMinute);
}

/** "Tuesday, Wednesday · 6:00 PM–7:00 PM" or "Monday, 9 Nov 2026 · 2:00 PM–3:00 PM · One-off". */
export function describeCommitment(c: FixedCommitment): string {
  const when = formatRange(c.startTime, c.endTime);
  if (c.recurrence === "once") {
    const wd = weekdayOfDate(c.date);
    return `${wd ? `${WEEKDAY_NAMES[wd]}, ` : ""}${c.date ? formatDate(c.date) : "No date"} · ${when} · One-off`;
  }
  return `${formatDays(c.days)} · ${when}`;
}
