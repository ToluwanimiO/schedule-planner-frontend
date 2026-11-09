import { describe, expect, it } from "vitest";
import type { ScheduleResult } from "../domain/types";
import { buildSummary } from "../utils/scheduleSummary";
import { plan, task } from "./fixtures";

const result = (over: Partial<ScheduleResult>): ScheduleResult => ({
  mode: "greedy", strategy: "priority-first", provenance: { kind: "real", engine: "test" }, sessions: [], unscheduled: [], notes: [], generatedAt: "2026-11-09T00:00:00Z", ...over,
});

describe("buildSummary", () => {
  const input = plan({ tasks: [task({ id: "a", weeklyTargetMinutes: 120, deadline: { day: 2, time: "12:00" } }), task({ id: "b", weeklyTargetMinutes: 60 }), task({ id: "c", goalId: "g2", weeklyTargetMinutes: 30 })] });
  const r = result({
    sessions: [
      { id: "1", taskId: "a", day: 1, startTime: "09:00", endTime: "11:00", minutes: 120 },
      { id: "2", taskId: "b", day: 1, startTime: "11:00", endTime: "11:30", minutes: 30 },
    ],
    unscheduled: [{ taskId: "b", remainingMinutes: 30, reasons: [{ code: "insufficient-time", message: "No time." }] }],
  });
  const s = buildSummary(input, r);
  it("totals requested, scheduled and unscheduled minutes consistently", () => {
    expect([s.requestedMinutes, s.scheduledMinutes, s.unscheduledMinutes]).toEqual([210, 150, 60]);
    expect(s.coveragePercent).toBe(71);
  });
  it("counts full vs partial/unscheduled tasks", () => {
    expect([s.tasksFull, s.tasksPartialOrNone]).toEqual([1, 2]);
    expect(s.tasks.map(t => t.status)).toEqual(["full", "partial", "none"]);
  });
  it("derives deadline outcomes from sessions", () => {
    expect([s.deadlinesMet, s.deadlinesMissed]).toEqual([1, 0]);
  });
  it("only reports reasons the scheduler supplied", () => {
    expect(s.tasks[1].reasons).toEqual(["No time."]);
    expect(s.tasks[2].reasons).toEqual([]);
  });
  it("handles an empty plan without NaN", () => {
    const e = buildSummary(plan({ tasks: [] }), result({}));
    expect([e.requestedMinutes, e.coveragePercent]).toEqual([0, 0]);
  });
  it("never counts sessions for unknown tasks as scheduled work", () => {
    const x = buildSummary(input, result({ sessions: [{ id: "9", taskId: "ghost", day: 1, startTime: "09:00", endTime: "10:00", minutes: 60 }] }));
    expect(x.scheduledMinutes).toBe(0);
  });
});
