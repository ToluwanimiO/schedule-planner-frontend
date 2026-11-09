import type {
  SchedulingInput as UiInput, ScheduleResult, Task as UiTask, UnscheduledReasonCode, Weekday, SchedulerMode
} from "../domain/types";

import { fromMinutes, toMinutes, weekdayOfDate } from "../utils/timeUtils";
import { onceIsInWeek } from "../utils/commitments";
import type { SchedulingInput as EngineInput, SchedulingResult, UnscheduledReason } from "./engineTypes";

const PRIORITY = { high: 5, medium: 3, low: 1 } as const;

function toEngineDeadline(t: UiTask) {
  if (!t.deadline) return undefined;
  const m = toMinutes(t.deadline.time);
  if (m < 1440) return { day: t.deadline.day, minuteOfDay: m };
  // "24:00" = end of that day. Your engine caps minuteOfDay at 1439, so use 00:00 of the next day.
  // On Sunday that means "no deadline inside this week".
  return t.deadline.day === 7 ? undefined : { day: (t.deadline.day + 1) as Weekday, minuteOfDay: 0 };
}

export function toEngineInput(input: UiInput): EngineInput {
  const byDay = new Map<Weekday, { startMinute: number; endMinute: number }[]>();
  for (const w of input.availability) {
    const list = byDay.get(w.day) ?? [];
    list.push({ startMinute: toMinutes(w.startTime), endMinute: toMinutes(w.endTime) });
    byDay.set(w.day, list);
  }
  return {
    goals: input.goals.map(g => ({ ...g })),               // add fields your Goal type needs
    tasks: input.tasks.map(t => ({
      id: t.id, title: t.title, goalId: t.goalId,
      weeklyTargetMinutes: t.weeklyTargetMinutes,
      priority: PRIORITY[t.priority],
      splittable: t.splittable,
      // your validateInput requires 0 < minSession <= target, even for unsplittable tasks
      minSessionMinutes: t.splittable ? t.minSessionMinutes : t.weeklyTargetMinutes,
      maxMinutesPerDay: t.maxMinutesPerDay,
      deadline: toEngineDeadline(t),
    })),
    availability: [...byDay].map(([day, windows]) => ({
      day, windows: windows.sort((a, b) => a.startMinute - b.startMinute),
    })),
    fixedCommitments: input.commitments.flatMap(c => {
      const days: Weekday[] = c.recurrence === "weekly"
        ? c.days
        : onceIsInWeek(c, input.weekStart) ? [weekdayOfDate(c.date)!] : [];
      return days.length
        ? [{ id: c.id, title: c.title, days, startMinute: toMinutes(c.startTime), endMinute: toMinutes(c.endTime) }]
        : [];
    }),
    preferences: { strategy: input.strategy },
  };
}

function reasonFor(r: UnscheduledReason, t: UiTask): { code: UnscheduledReasonCode; message: string } {
  switch (r) {
    case "insufficient-availability":
      return { code: "insufficient-time", message: "There wasn’t enough free time left for this task after other work and commitments." };
    case "daily-limit-reached":
      return { code: "daily-limit", message: "This task’s daily limit was reached on at least one day." };
    case "session-too-short":
      return t.splittable
        ? { code: "min-session", message: "The free gaps left were shorter than this task’s minimum session." }
        : { code: "not-splittable", message: "No free block was long enough for this task’s single uninterrupted session." };
    case "deadline-passed":
      return { code: "deadline", message: "No free time was left before this task’s deadline." };
    default:
      return { code: "other", message: `The scheduler reported: ${String(r)}.` };
  }
}
export interface EngineMeta { mode: SchedulerMode; engineLabel: string; notes: string[] }

export function fromEngineResult(input: UiInput, res: SchedulingResult, meta: EngineMeta): ScheduleResult {
  const tasks = new Map(input.tasks.map(t => [t.id, t]));
  return {
    mode: meta.mode,
    strategy: input.strategy,
    provenance: { kind: "real", engine: meta.engineLabel },
    sessions: res.sessions.map(s => ({
      id: s.id, taskId: s.taskId, day: s.day,
      startTime: fromMinutes(s.startMinute), endTime: fromMinutes(s.endMinute),
      minutes: s.endMinute - s.startMinute,
    })),
    unscheduled: res.allocations
      .filter(a => a.remainingMinutes > 0)
      .map(a => ({
        taskId: a.taskId,
        remainingMinutes: a.remainingMinutes,
        reasons: a.reasons.map(r => reasonFor(r, tasks.get(a.taskId)!)),
      })),
    notes: meta.notes,
    generatedAt: new Date().toISOString(),
  };
}