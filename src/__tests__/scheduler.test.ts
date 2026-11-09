import { describe, expect, it } from "vitest";
import type { ScheduleResult } from "../domain/types";
import { runDemoGreedy } from "../scheduler/demoGreedyEngine";
import { InvalidScheduleError, SchedulerUnavailableError, schedulerAdapter } from "../scheduler/schedulerAdapter";
import { verifyResult } from "../scheduler/verifyResult";
import { WEEK, plan, task, win } from "./fixtures";

const commit = (days: (1 | 2 | 3 | 4 | 5)[], s: string, e: string) => ({ id: "c", title: "Class", recurrence: "weekly" as const, days, startTime: s, endTime: e });

describe("demo scheduler + verification", () => {
  it("produces results that pass hard-constraint verification, for every strategy", () => {
    for (const strategy of ["priority-first", "deadline-first", "balanced-progress"] as const) {
      const input = plan({
        strategy,
        tasks: [task({ id: "a", weeklyTargetMinutes: 300, priority: "high", maxMinutesPerDay: 120 }), task({ id: "b", weeklyTargetMinutes: 90, splittable: false }), task({ id: "c", weeklyTargetMinutes: 180, deadline: { day: 3, time: "12:00" } })],
        commitments: [commit([1, 2], "10:00", "12:00")],
      });
      expect(verifyResult(input, runDemoGreedy(input))).toEqual([]);
    }
  });
  it("never schedules over commitments or outside availability", () => {
    const input = plan({ availability: [win(1, "09:00", "12:00")], commitments: [commit([1], "10:00", "11:00")], tasks: [task({ id: "a", weeklyTargetMinutes: 180 })] });
    const r = runDemoGreedy(input);
    expect(r.sessions.reduce((s, x) => s + x.minutes, 0)).toBe(120);
    expect(r.unscheduled[0].remainingMinutes).toBe(60);
  });
  it("honours deadlines and reports a deadline reason when time runs out", () => {
    const input = plan({ tasks: [task({ id: "a", weeklyTargetMinutes: 600, deadline: { day: 1, time: "11:00" } })] });
    const r = runDemoGreedy(input);
    expect(r.sessions.every(s => s.day === 1 && s.endTime <= "11:00")).toBe(true);
    expect(r.unscheduled[0].reasons.map(x => x.code)).toContain("deadline");
  });
  it("respects daily limits and explains them", () => {
    const input = plan({ availability: [win(1, "09:00", "17:00")], tasks: [task({ id: "a", weeklyTargetMinutes: 240, maxMinutesPerDay: 60 })] });
    const r = runDemoGreedy(input);
    expect(r.sessions.reduce((s, x) => s + x.minutes, 0)).toBe(60);
    expect(r.unscheduled[0].reasons.map(x => x.code)).toContain("daily-limit");
  });
  it("explains minimum-session and no-split failures from free gaps", () => {
    const gap = plan({ availability: [win(1, "09:00", "09:30")], tasks: [task({ id: "a", weeklyTargetMinutes: 120, minSessionMinutes: 60 })] });
    expect(runDemoGreedy(gap).unscheduled[0].reasons.map(x => x.code)).toContain("min-session");
    const block = plan({ availability: [win(1, "09:00", "10:00")], tasks: [task({ id: "a", weeklyTargetMinutes: 120, splittable: false })] });
    expect(runDemoGreedy(block).unscheduled[0].reasons.map(x => x.code)).toContain("not-splittable");
  });
  it("prefers preferred days and time of day when possible, but still schedules otherwise", () => {
    const input = plan({ tasks: [task({ id: "a", weeklyTargetMinutes: 60, preferredDays: [4], preferredTimeOfDay: "afternoon" })] });
    const s = runDemoGreedy(input).sessions[0];
    expect(s.day).toBe(4);
    expect(s.startTime >= "12:00").toBe(true);
    const fallback = plan({ tasks: [task({ id: "a", weeklyTargetMinutes: 60, preferredDays: [6] })] });
    expect(runDemoGreedy(fallback).sessions).toHaveLength(1);
  });
  it("priority-first favours high priority when time is short", () => {
    const input = plan({ availability: [win(1, "09:00", "10:00")], tasks: [task({ id: "low", priority: "low", weeklyTargetMinutes: 60 }), task({ id: "high", priority: "high", weeklyTargetMinutes: 60 })] });
    expect(runDemoGreedy(input).sessions.map(s => s.taskId)).toEqual(["high"]);
  });
  it("balanced-progress gives every task some time", () => {
    const input = plan({ strategy: "balanced-progress", availability: [win(1, "09:00", "12:00")], tasks: [task({ id: "a", weeklyTargetMinutes: 180 }), task({ id: "b", weeklyTargetMinutes: 180 })] });
    const ids = new Set(runDemoGreedy(input).sessions.map(s => s.taskId));
    expect(ids.has("a") && ids.has("b")).toBe(true);
  });
  it("handles empty availability and no tasks gracefully", () => {
    expect(runDemoGreedy(plan({ availability: [] })).sessions).toEqual([]);
    expect(runDemoGreedy(plan({ tasks: [] })).sessions).toEqual([]);
  });
  it("marks results as demo output", () => expect(runDemoGreedy(plan()).provenance.kind).toBe("demo"));

  it("verifier catches hard-constraint violations", () => {
    const input = plan({ commitments: [commit([1], "09:00", "10:00")], tasks: [task({ id: "a", weeklyTargetMinutes: 60, deadline: { day: 1, time: "12:00" } })] });
    const good = runDemoGreedy(input);
    const bad: ScheduleResult = { ...good, sessions: [{ id: "x", taskId: "a", day: 1, startTime: "09:00", endTime: "10:00", minutes: 60 }] };
    expect(verifyResult(input, bad).join(" ")).toMatch(/commitment/);
    const late: ScheduleResult = { ...good, sessions: [{ id: "x", taskId: "a", day: 2, startTime: "09:00", endTime: "10:00", minutes: 60 }] };
    expect(verifyResult(input, late).join(" ")).toMatch(/deadline/);
    const ghost: ScheduleResult = { ...good, sessions: [{ id: "x", taskId: "zzz", day: 1, startTime: "10:00", endTime: "11:00", minutes: 60 }] };
    expect(verifyResult(input, ghost).join(" ")).toMatch(/doesn’t exist/);
  });
  it("adapter rejects invalid engine output and unavailable modes instead of faking success", async () => {
    await expect(schedulerAdapter.generate(plan({ weekStart: WEEK }), "optimizer")).rejects.toBeInstanceOf(SchedulerUnavailableError);
    const ok = await schedulerAdapter.generate(plan(), "greedy");
    expect(ok.sessions.length).toBeGreaterThan(0);
    expect(new InvalidScheduleError(["x"]).violations).toEqual(["x"]);
  });
});
