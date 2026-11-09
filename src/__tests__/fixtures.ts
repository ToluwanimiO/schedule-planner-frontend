import type { AvailabilityWindow, PlanningInput, Task, Weekday } from "../domain/types";

export const WEEK = "2026-11-09"; // a Monday

export const win = (day: Weekday, startTime: string, endTime: string, id = `w${day}${startTime}`): AvailabilityWindow => ({ id, day, startTime, endTime });

export const task = (over: Partial<Task> & Pick<Task, "id">): Task => ({
  goalId: "g1", title: over.id, weeklyTargetMinutes: 60, priority: "medium", splittable: true, minSessionMinutes: 30, preferredDays: [], ...over,
});

export function plan(over: Partial<PlanningInput> = {}): PlanningInput {
  return {
    weekStart: WEEK,
    goals: [{ id: "g1", title: "Python" }, { id: "g2", title: "Reading" }],
    tasks: [task({ id: "t1", weeklyTargetMinutes: 120 })],
    availability: ([1, 2, 3, 4, 5] as Weekday[]).map(d => win(d, "09:00", "17:00")),
    commitments: [],
    strategy: "priority-first",
    ...over,
  };
}
