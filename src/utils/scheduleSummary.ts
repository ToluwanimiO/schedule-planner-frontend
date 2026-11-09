import type {
  PlanningInput, ScheduleResult, ScheduleSummary, TaskBreakdown,
} from "../domain/types";
import { toMinutes } from "./timeUtils";

/**
 * Pure function: ScheduleResult (+ the input it was generated from) -> summary statistics.
 * Used by both the on-screen summary and the PDF so they cannot disagree.
 * Scheduled minutes are derived from sessions. Reasons are only those the engine reported.
 */
export function buildSummary(input: PlanningInput, result: ScheduleResult): ScheduleSummary {
  const goalTitle = new Map(input.goals.map(g => [g.id, g.title.trim()]));
  const scheduledByTask = new Map<string, number>();
  const lastEndByTask = new Map<string, number>();
  for (const s of result.sessions) {
    scheduledByTask.set(s.taskId, (scheduledByTask.get(s.taskId) ?? 0) + s.minutes);
    const abs = s.day * 1440 + toMinutes(s.endTime);
    lastEndByTask.set(s.taskId, Math.max(lastEndByTask.get(s.taskId) ?? 0, abs));
  }
  const reasonsByTask = new Map(result.unscheduled.map(u => [u.taskId, u.reasons.map(r => r.message)]));

  const tasks: TaskBreakdown[] = input.tasks.map(t => {
    const requested = t.weeklyTargetMinutes;
    const scheduled = Math.min(requested, scheduledByTask.get(t.id) ?? 0);
    const remaining = Math.max(0, requested - scheduled);
    const status: TaskBreakdown["status"] = remaining === 0 ? "full" : scheduled === 0 ? "none" : "partial";
    let deadlineOutcome: TaskBreakdown["deadlineOutcome"] = "none";
    if (t.deadline) {
      const limit = t.deadline.day * 1440 + toMinutes(t.deadline.time);
      const onTime = (lastEndByTask.get(t.id) ?? 0) <= limit;
      deadlineOutcome = status === "full" && onTime ? "met" : "missed";
    }
    return {
      taskId: t.id, title: t.title.trim(), goalTitle: goalTitle.get(t.goalId) ?? "Unknown goal",
      requestedMinutes: requested, scheduledMinutes: scheduled, remainingMinutes: remaining,
      status, deadlineOutcome, reasons: remaining > 0 ? reasonsByTask.get(t.id) ?? [] : [],
    };
  });

  const requestedMinutes = tasks.reduce((s, t) => s + t.requestedMinutes, 0);
  const scheduledMinutes = tasks.reduce((s, t) => s + t.scheduledMinutes, 0);
  return {
    requestedMinutes,
    scheduledMinutes,
    unscheduledMinutes: requestedMinutes - scheduledMinutes,
    coveragePercent: requestedMinutes ? Math.round((scheduledMinutes / requestedMinutes) * 100) : 0,
    tasksFull: tasks.filter(t => t.status === "full").length,
    tasksPartialOrNone: tasks.filter(t => t.status !== "full").length,
    deadlinesMet: tasks.filter(t => t.deadlineOutcome === "met").length,
    deadlinesMissed: tasks.filter(t => t.deadlineOutcome === "missed").length,
    tasks,
  };
}
