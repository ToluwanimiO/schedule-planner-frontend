import type { AvailabilityWindow, FixedCommitment, Weekday } from "../domain/types";
import { WEEKDAYS } from "../domain/constants";
import { expandCommitments } from "./commitments";
import { toMinutes } from "./timeUtils";

export interface Interval { start: number; end: number }

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter(i => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

export function subtractInterval(list: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const i of list) {
    if (cut.end <= i.start || cut.start >= i.end) { out.push(i); continue; }
    if (cut.start > i.start) out.push({ start: i.start, end: cut.start });
    if (cut.end < i.end) out.push({ start: cut.end, end: i.end });
  }
  return out;
}

export const totalLength = (list: Interval[]) => list.reduce((s, i) => s + (i.end - i.start), 0);

/**
 * Free working time per weekday: availability windows (merged) minus every commitment
 * occurrence in the planning week. Invalid windows are ignored (validation reports them).
 */
export function freeIntervalsByDay(
  availability: readonly AvailabilityWindow[],
  commitments: readonly FixedCommitment[],
  weekStart: string,
): Record<Weekday, Interval[]> {
  const result = {} as Record<Weekday, Interval[]>;
  const occurrences = expandCommitments(commitments, weekStart);
  for (const day of WEEKDAYS) {
    let free = mergeIntervals(
      availability.filter(w => w.day === day).map(w => ({ start: toMinutes(w.startTime), end: toMinutes(w.endTime) }))
        .filter(i => Number.isFinite(i.start) && Number.isFinite(i.end)),
    );
    for (const o of occurrences.filter(o => o.day === day)) {
      free = subtractInterval(free, { start: o.startMinute, end: o.endMinute });
    }
    result[day] = free;
  }
  return result;
}
