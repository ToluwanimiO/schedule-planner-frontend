import { WEEKDAYS, WEEKDAY_NAMES } from "../domain/constants";
import type { ScheduleResult, SchedulingInput } from "../domain/types";
import { freeIntervalsByDay } from "../utils/intervals";
import { formatDuration, formatRange, toMinutes } from "../utils/timeUtils";

/**
 * Independent check of a ScheduleResult against the HARD constraints in the input.
 * Returns human-readable violations (empty = valid). Run on every engine's output so the UI never
 * presents a timetable that breaks availability, commitments, deadlines, limits or split rules.
 */
export function verifyResult(input: SchedulingInput, result: ScheduleResult): string[] {
  const v: string[] = [];
  const tasks = new Map(input.tasks.map(t => [t.id, t]));
  // Free time ignoring *other sessions* = availability minus commitments.
  const free = freeIntervalsByDay(input.availability, input.commitments, input.weekStart);
  const label = (s: ScheduleResult["sessions"][number]) =>
    `${tasks.get(s.taskId)?.title ?? "Unknown task"} on ${WEEKDAY_NAMES[s.day]} ${formatRange(s.startTime, s.endTime)}`;

  const perTask = new Map<string, number>();
  const perTaskDay = new Map<string, number>();
  const count = new Map<string, number>();

  for (const s of result.sessions) {
    const task = tasks.get(s.taskId);
    if (!task) { v.push(`A session refers to a task that doesn’t exist (${s.taskId}).`); continue; }
    const a = toMinutes(s.startTime), b = toMinutes(s.endTime);
    if (!WEEKDAYS.includes(s.day) || Number.isNaN(a) || Number.isNaN(b) || b <= a) { v.push(`${label(s)} has an invalid day or time.`); continue; }
    if (s.minutes !== b - a) v.push(`${label(s)} reports ${s.minutes} minutes but spans ${b - a}.`);
    if (!free[s.day].some(i => a >= i.start && b <= i.end)) v.push(`${label(s)} falls outside your availability or overlaps a fixed commitment.`);
    if (task.deadline) {
      const limit = s.day < task.deadline.day ? 1440 : s.day === task.deadline.day ? toMinutes(task.deadline.time) : -1;
      if (b > limit) v.push(`${label(s)} ends after the task’s deadline.`);
    }
    if (task.splittable && b - a < task.minSessionMinutes) v.push(`${label(s)} is shorter than the minimum session of ${formatDuration(task.minSessionMinutes)}.`);
    perTask.set(task.id, (perTask.get(task.id) ?? 0) + (b - a));
    const k = `${task.id}:${s.day}`;
    perTaskDay.set(k, (perTaskDay.get(k) ?? 0) + (b - a));
    count.set(task.id, (count.get(task.id) ?? 0) + 1);
  }

  const sorted = [...result.sessions].filter(s => !Number.isNaN(toMinutes(s.startTime))).sort((x, y) => x.day - y.day || toMinutes(x.startTime) - toMinutes(y.startTime));
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1], c = sorted[i];
    if (p.day === c.day && toMinutes(c.startTime) < toMinutes(p.endTime)) v.push(`${label(p)} overlaps ${label(c)}.`);
  }
  for (const [id, total] of perTask) {
    const t = tasks.get(id)!;
    if (total > t.weeklyTargetMinutes) v.push(`“${t.title}” is scheduled for ${formatDuration(total)}, more than its ${formatDuration(t.weeklyTargetMinutes)} target.`);
    if (!t.splittable && (count.get(id)! > 1 || total !== t.weeklyTargetMinutes)) v.push(`“${t.title}” can’t be split but was scheduled in pieces or only partly.`);
  }
  for (const [k, total] of perTaskDay) {
    const [id, day] = k.split(":");
    const t = tasks.get(id)!;
    if (t.maxMinutesPerDay !== undefined && total > t.maxMinutesPerDay) {
      v.push(`“${t.title}” exceeds its daily maximum of ${formatDuration(t.maxMinutesPerDay)} on ${WEEKDAY_NAMES[Number(day) as 1]}.`);
    }
  }
  for (const u of result.unscheduled) {
    if (!tasks.has(u.taskId) && !u.reasons.some(r => r.code === "invalid-reference")) v.push(`Unscheduled work refers to an unknown task (${u.taskId}).`);
  }
  return v;
}
