import { MIN_TARGET_MINUTES, MINUTE_STEP, WEEKDAY_NAMES } from "../domain/constants";
import type {
  AvailabilityWindow, FixedCommitment, Goal, PlanningInput, Task, ValidationIssue, WizardStepId,
} from "../domain/types";
import { appliesOn, onceIsInWeek } from "./commitments";
import { freeIntervalsByDay, totalLength } from "./intervals";
import {
  formatDuration, formatRange, formatTime, isValidDate, isValidTime, rangesOverlap, toMinutes,
} from "./timeUtils";
import { WEEKDAYS } from "../domain/constants";

type Draft = Omit<ValidationIssue, "id">;
const mk = (list: ValidationIssue[], i: Draft) => list.push({ ...i, id: `${i.step}:${i.entityId ?? "plan"}:${list.length}` });

export const isMultipleOfStep = (n: number) => Number.isInteger(n) && n % MINUTE_STEP === 0;

export function validateGoals(goals: readonly Goal[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!goals.length) mk(out, { step: "goals", severity: "error", message: "Add at least one goal to plan your week." });
  goals.forEach((g, i) => {
    if (!g.title.trim()) {
      mk(out, { step: "goals", severity: "error", entityId: g.id, deferred: true, message: `Goal ${i + 1} needs a title.` });
    }
    const dupe = goals.findIndex(o => o.id !== g.id && o.title.trim() && o.title.trim().toLowerCase() === g.title.trim().toLowerCase());
    if (g.title.trim() && dupe !== -1 && dupe < i) {
      mk(out, { step: "goals", severity: "warning", entityId: g.id, message: `“${g.title.trim()}” appears more than once. You may want to merge the duplicates.` });
    }
  });
  return out;
}

export function validateTask(task: Task, goalIds: ReadonlySet<string>): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const name = task.title.trim() ? `“${task.title.trim()}”` : "This task";
  const add = (message: string, field?: string, deferred = false) =>
    mk(out, { step: "tasks", severity: "error", entityId: task.id, message, field, deferred });

  if (!task.title.trim()) add("Give this task a title.", "title", true);
  if (!goalIds.has(task.goalId)) add(`${name} belongs to a goal that no longer exists. Move it to another goal or remove it.`, "goalId");

  const target = task.weeklyTargetMinutes;
  const targetOk = Number.isFinite(target) && target >= MIN_TARGET_MINUTES && isMultipleOfStep(target);
  if (!targetOk) add(`Enter whole minutes, at least ${MIN_TARGET_MINUTES}, in ${MINUTE_STEP}-minute steps (for example 60 or 90).`, "weeklyTargetMinutes");

  if (task.deadline) {
    if (!isValidTime(task.deadline.time)) add("Choose a valid deadline time.", "deadline");
    if (!WEEKDAYS.includes(task.deadline.day)) add("Choose a deadline day.", "deadline");
  }

  if (task.splittable) {
    const min = task.minSessionMinutes;
    if (!Number.isFinite(min) || min < MINUTE_STEP || !isMultipleOfStep(min)) {
      add(`Enter at least ${MINUTE_STEP} minutes, in ${MINUTE_STEP}-minute steps.`, "minSessionMinutes");
    } else if (targetOk && min > target) {
      add(`Can’t be longer than the weekly target (${formatDuration(target)}).`, "minSessionMinutes");
    }
  }

  if (task.maxMinutesPerDay !== undefined) {
    const cap = task.maxMinutesPerDay;
    if (!Number.isFinite(cap) || cap < MINUTE_STEP || !isMultipleOfStep(cap)) {
      add(`Enter at least ${MINUTE_STEP} minutes, in ${MINUTE_STEP}-minute steps, or turn the limit off.`, "maxMinutesPerDay");
    } else {
      if (!task.splittable && targetOk && cap < target) {
        add(`${name} can’t be split, so the daily maximum must be at least the weekly target (${formatDuration(target)}).`, "maxMinutesPerDay");
      }
      if (task.splittable && Number.isFinite(task.minSessionMinutes) && cap < task.minSessionMinutes) {
        add(`Shorter than the minimum session (${formatDuration(task.minSessionMinutes)}), so no session could ever fit.`, "maxMinutesPerDay");
      }
    }
  }
  return out;
}

export function validateTasks(tasks: readonly Task[], goals: readonly Goal[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (goals.length && !tasks.length) {
    mk(out, { step: "tasks", severity: "error", message: "Add at least one task under a goal." });
  }
  const ids = new Set(goals.map(g => g.id));
  tasks.forEach(t => out.push(...validateTask(t, ids)));
  for (const g of goals) {
    if (tasks.length && !tasks.some(t => t.goalId === g.id)) {
      mk(out, { step: "tasks", severity: "warning", entityId: g.id, message: `“${g.title.trim() || "Untitled goal"}” has no tasks, so it won’t get any time.` });
    }
  }
  return out;
}

export function validateWindow(w: AvailabilityWindow): string | null {
  if (!isValidTime(w.startTime) || !isValidTime(w.endTime)) return "Choose a start and end time.";
  if (toMinutes(w.endTime) <= toMinutes(w.startTime)) {
    return "End time must be after start time. Windows that cross midnight aren’t supported — end at 12:00 AM and start a new window the next day.";
  }
  return null;
}

export function validateAvailability(windows: readonly AvailabilityWindow[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const valid = windows.filter(w => !validateWindow(w));
  if (!valid.length) mk(out, { step: "availability", severity: "error", message: "Add at least one valid availability window." });
  for (const w of windows) {
    const problem = validateWindow(w);
    if (problem) mk(out, { step: "availability", severity: "error", entityId: w.id, message: `${WEEKDAY_NAMES[w.day]}: ${problem}` });
  }
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i], b = valid[j];
      if (a.day === b.day && rangesOverlap(toMinutes(a.startTime), toMinutes(a.endTime), toMinutes(b.startTime), toMinutes(b.endTime))) {
        mk(out, {
          step: "availability", severity: "error", entityId: b.id,
          message: `${WEEKDAY_NAMES[a.day]}: ${formatRange(a.startTime, a.endTime)} overlaps ${formatRange(b.startTime, b.endTime)}. Merge or adjust these windows.`,
        });
      }
    }
  }
  return out;
}

/** Validation for a single commitment (used inline by the editor before saving). */
export function validateCommitment(c: FixedCommitment): string[] {
  const out: string[] = [];
  if (!c.title.trim()) out.push("Give this commitment a title.");
  if (!isValidTime(c.startTime) || !isValidTime(c.endTime)) out.push("Choose a start and end time.");
  else if (toMinutes(c.endTime) <= toMinutes(c.startTime)) {
    out.push("End time must be after start time. Events that cross midnight aren’t supported — create one that ends at 12:00 AM and another that starts the next day.");
  }
  if (c.recurrence === "weekly" && c.days.length === 0) out.push("Select at least one weekday.");
  if (c.recurrence === "once") {
    if (!c.date || !isValidDate(c.date)) out.push("Choose the date of this one-off commitment.");
  }
  return out;
}

export function validateCommitments(commitments: readonly FixedCommitment[], weekStart: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const c of commitments) {
    for (const message of validateCommitment(c)) {
      mk(out, { step: "availability", severity: "error", entityId: c.id, message: `${c.title.trim() || "Commitment"}: ${message}` });
    }
    if (c.recurrence === "once" && c.date && isValidDate(c.date) && !onceIsInWeek(c, weekStart)) {
      mk(out, { step: "availability", severity: "warning", entityId: c.id, message: `“${c.title.trim() || "Commitment"}” is on a date outside the planning week, so it won’t affect this timetable.` });
    }
  }
  const ok = commitments.filter(c => validateCommitment(c).length === 0);
  for (let i = 0; i < ok.length; i++) {
    for (let j = i + 1; j < ok.length; j++) {
      const a = ok[i], b = ok[j];
      if (!rangesOverlap(toMinutes(a.startTime), toMinutes(a.endTime), toMinutes(b.startTime), toMinutes(b.endTime))) continue;
      const clash = WEEKDAYS.filter(d => appliesOn(a, d, weekStart) && appliesOn(b, d, weekStart));
      if (clash.length) {
        mk(out, {
          step: "availability", severity: "warning", entityId: b.id,
          message: `“${a.title.trim()}” and “${b.title.trim()}” overlap on ${clash.map(d => WEEKDAY_NAMES[d]).join(", ")} (${formatTime(a.startTime)}–${formatTime(a.endTime)} vs ${formatTime(b.startTime)}–${formatTime(b.endTime)}). Both will block that time.`,
        });
      }
    }
  }
  return out;
}

/** Full-plan validation. Errors block generation; warnings are shown but never block. */
export function validatePlan(input: PlanningInput): ValidationIssue[] {
  const out: ValidationIssue[] = [
    ...validateGoals(input.goals),
    ...validateTasks(input.tasks, input.goals),
    ...validateAvailability(input.availability),
    ...validateCommitments(input.commitments, input.weekStart),
  ];
  const hasErrors = out.some(i => i.severity === "error");
  if (!hasErrors) {
    const free = freeIntervalsByDay(input.availability, input.commitments, input.weekStart);
    const freeMinutes = WEEKDAYS.reduce((s, d) => s + totalLength(free[d]), 0);
    const requested = input.tasks.reduce((s, t) => s + t.weeklyTargetMinutes, 0);
    if (freeMinutes === 0) {
      mk(out, { step: "review", severity: "warning", message: "Your commitments leave no free availability this week, so nothing can be scheduled." });
    } else if (requested > freeMinutes) {
      mk(out, {
        step: "review", severity: "warning",
        message: `You requested ${formatDuration(requested)} of work but only ${formatDuration(freeMinutes)} is free after commitments. Some work will stay unscheduled.`,
      });
    }
    for (const t of input.tasks) {
      const dl = t.deadline;
      if (!dl) continue;
      const before = WEEKDAYS.reduce((sum, d) => {
        if (d > dl.day) return sum;
        const limit = d === dl.day ? toMinutes(dl.time) : 1440;
        return sum + free[d].reduce((a, i) => a + Math.max(0, Math.min(i.end, limit) - i.start), 0);
      }, 0);
      if (before < t.weeklyTargetMinutes) {
        mk(out, {
          step: "tasks", severity: "warning", entityId: t.id,
          message: `“${t.title.trim()}” needs ${formatDuration(t.weeklyTargetMinutes)} before ${WEEKDAY_NAMES[dl.day]} ${formatTime(dl.time)}, but only ${formatDuration(before)} of free time exists before then.`,
        });
      }
    }
  }
  return out;
}

export const errorsOf = (issues: readonly ValidationIssue[]) => issues.filter(i => i.severity === "error");
export const issuesForStep = (issues: readonly ValidationIssue[], step: WizardStepId) => issues.filter(i => i.step === step);
