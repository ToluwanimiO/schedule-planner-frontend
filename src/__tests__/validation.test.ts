import { describe, expect, it } from "vitest";
import { errorsOf, validateAvailability, validateCommitment, validateCommitments, validatePlan, validateTask } from "../utils/scheduleValidation";
import { plan, task, win, WEEK } from "./fixtures";

const ids = new Set(["g1"]);

describe("validation", () => {
  it("accepts a valid plan", () => expect(errorsOf(validatePlan(plan()))).toEqual([]));
  it("blocks an empty plan with actionable messages", () => {
    const issues = validatePlan(plan({ goals: [], tasks: [] }));
    expect(errorsOf(issues).some(i => i.step === "goals")).toBe(true);
  });
  it("rejects bad numbers without clamping them", () => {
    expect(validateTask(task({ id: "a", weeklyTargetMinutes: 7 }), ids).some(i => i.field === "weeklyTargetMinutes")).toBe(true);
    expect(validateTask(task({ id: "a", weeklyTargetMinutes: NaN }), ids).some(i => i.field === "weeklyTargetMinutes")).toBe(true);
    expect(validateTask(task({ id: "a", weeklyTargetMinutes: 60, minSessionMinutes: 90 }), ids).some(i => i.field === "minSessionMinutes")).toBe(true);
    expect(validateTask(task({ id: "a", splittable: false, weeklyTargetMinutes: 90, maxMinutesPerDay: 60 }), ids).some(i => i.field === "maxMinutesPerDay")).toBe(true);
  });
  it("flags tasks pointing at missing goals", () => {
    expect(validateTask(task({ id: "a", goalId: "nope" }), ids).some(i => i.field === "goalId")).toBe(true);
  });
  it("hides required-title errors until the user tries to continue", () => {
    expect(validateTask(task({ id: "a", title: "" }), ids).find(i => i.field === "title")?.deferred).toBe(true);
  });
  it("rejects end-before-start and overnight windows and commitments", () => {
    expect(validateAvailability([win(1, "17:00", "09:00")]).length).toBeGreaterThan(0);
    const c = { id: "c", title: "Night", recurrence: "weekly" as const, days: [1 as const], startTime: "22:00", endTime: "01:00" };
    expect(validateCommitment(c).join(" ")).toMatch(/cross midnight/);
  });
  it("requires at least one weekday for weekly commitments and a date for one-offs", () => {
    const base = { id: "c", title: "X", startTime: "10:00", endTime: "11:00" };
    expect(validateCommitment({ ...base, recurrence: "weekly", days: [] })).toContain("Select at least one weekday.");
    expect(validateCommitment({ ...base, recurrence: "once", days: [] }).join(" ")).toMatch(/date/);
  });
  it("flags overlapping availability windows on one day", () => {
    expect(errorsOf(validateAvailability([win(1, "09:00", "12:00", "a"), win(1, "11:00", "14:00", "b")])).length).toBe(1);
    expect(validateAvailability([win(1, "09:00", "12:00", "a"), win(1, "12:00", "14:00", "b")])).toEqual([]);
  });
  it("flags overlapping commitments only when they share a day", () => {
    const mk = (id: string, days: (1 | 2 | 3)[], s: string, e: string) => ({ id, title: id, recurrence: "weekly" as const, days, startTime: s, endTime: e });
    expect(validateCommitments([mk("a", [1, 2], "10:00", "12:00"), mk("b", [2, 3], "11:00", "13:00")], WEEK)).toHaveLength(1);
    expect(validateCommitments([mk("a", [1], "10:00", "12:00"), mk("b", [2], "11:00", "13:00")], WEEK)).toHaveLength(0);
  });
  it("warns, not errors, when work exceeds free time", () => {
    const issues = validatePlan(plan({ tasks: [task({ id: "big", weeklyTargetMinutes: 9000 })] }));
    expect(errorsOf(issues)).toEqual([]);
    expect(issues.some(i => i.severity === "warning" && /free after commitments/.test(i.message))).toBe(true);
  });
});
