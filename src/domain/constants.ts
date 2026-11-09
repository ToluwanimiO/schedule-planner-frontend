import type { Priority, SchedulingStrategy, TimeOfDay, Weekday, WizardStepId } from "./types";

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday",
};
export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
};
export const WORK_WEEK: readonly Weekday[] = [1, 2, 3, 4, 5];
export const WEEKEND: readonly Weekday[] = [6, 7];

export const MINUTE_STEP = 15;
export const MIN_TARGET_MINUTES = 15;

export const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" };
export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
export const TIME_OF_DAY_LABEL: Record<TimeOfDay, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
/** [startMinute, endMinute) windows used for the soft time-of-day preference. */
export const TIME_OF_DAY_RANGE: Record<TimeOfDay, [number, number]> = {
  morning: [0, 12 * 60], afternoon: [12 * 60, 17 * 60], evening: [17 * 60, 24 * 60],
};

export const STRATEGIES: { id: SchedulingStrategy; label: string; description: string }[] = [
  { id: "priority-first", label: "Priority-first", description: "Your most important tasks get time first. Lower-priority tasks get what is left." },
  { id: "deadline-first", label: "Deadline-first", description: "Tasks with the earliest deadlines are placed first so they are less likely to be missed." },
  { id: "balanced-progress", label: "Balanced progress", description: "Time is shared out in rounds so every task moves forward, rather than one task taking everything." },
];
export const STRATEGY_LABEL: Record<SchedulingStrategy, string> =
  Object.fromEntries(STRATEGIES.map(s => [s.id, s.label])) as Record<SchedulingStrategy, string>;

export const WIZARD_STEPS: { id: WizardStepId; label: string; hint: string }[] = [
  { id: "goals", label: "Goals", hint: "What matters this week" },
  { id: "tasks", label: "Tasks", hint: "Turn goals into work" },
  { id: "availability", label: "Availability", hint: "Free time and commitments" },
  { id: "preferences", label: "Preferences", hint: "How to make trade-offs" },
  { id: "review", label: "Review", hint: "Check before generating" },
  { id: "schedule", label: "Timetable", hint: "Your generated week" },
];

/** Calendar rendering range (minutes from midnight). Expanded automatically if events fall outside. */
export const DEFAULT_CALENDAR_START = 6 * 60;
export const DEFAULT_CALENDAR_END = 22 * 60;

/** Goal colours: tinted fill + strong border + dark text (all ≥ 7:1 text contrast). Shared by the UI and the PDF. */
export interface Swatch { bg: string; border: string; text: string }
export const GOAL_PALETTE: readonly Swatch[] = [
  { bg: "#e1eee4", border: "#4f7f5e", text: "#1d3b29" },
  { bg: "#e2ebf6", border: "#4c78a8", text: "#1b3250" },
  { bg: "#f6e8da", border: "#b4703f", text: "#4a2b10" },
  { bg: "#ebe5f4", border: "#7b66a8", text: "#2e2347" },
  { bg: "#f4e2e7", border: "#b05a73", text: "#4a1a2b" },
  { bg: "#e2eeee", border: "#4a8a8a", text: "#143c3c" },
];
export const COMMITMENT_SWATCH: Swatch = { bg: "#ecece6", border: "#7c8278", text: "#363b34" };

export function goalSwatch(goals: readonly { id: string }[], goalId: string): Swatch {
  const i = goals.findIndex(g => g.id === goalId);
  return GOAL_PALETTE[(i < 0 ? 0 : i) % GOAL_PALETTE.length];
}
