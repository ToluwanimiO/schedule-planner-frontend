import type { AvailabilityWindow, FixedCommitment, Goal, Task, Weekday } from "./types";
import { WORK_WEEK } from "./constants";
import { newId } from "../utils/id";

export const createGoal = (title = ""): Goal => ({ id: newId("goal"), title });

export const createTask = (goalId: string): Task => ({
  id: newId("task"), goalId, title: "", weeklyTargetMinutes: 60, priority: "medium",
  splittable: true, minSessionMinutes: 30, preferredDays: [],
});

export const createWindow = (day: Weekday, startTime = "09:00", endTime = "17:00"): AvailabilityWindow => ({
  id: newId("win"), day, startTime, endTime,
});

/** Mon–Fri, 9:00 AM–5:00 PM. Editable on the availability step. */
export const defaultAvailability = (): AvailabilityWindow[] => WORK_WEEK.map(d => createWindow(d));

export const createCommitment = (): FixedCommitment => ({
  id: newId("commit"), title: "", recurrence: "weekly", days: [], startTime: "18:00", endTime: "19:00",
});
