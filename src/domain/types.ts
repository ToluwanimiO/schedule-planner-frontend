/**
 * Shared domain types.
 *
 * Conventions
 * - Weekday: ISO numbering, Monday = 1 … Sunday = 7.
 * - Time of day: "HH:mm" 24-hour strings in state; converted to minutes-from-midnight
 *   (0–1440) only inside utils/timeUtils.ts and the scheduler.
 * - Dates: "YYYY-MM-DD" (local calendar date, no timezone).
 */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Priority = "high" | "medium" | "low";
export type TimeOfDay = "morning" | "afternoon" | "evening";
export type SchedulingStrategy = "priority-first" | "deadline-first" | "balanced-progress";
export type SchedulerMode = "greedy" | "optimizer";

export interface Goal {
  id: string;
  title: string;
}

export interface Task {
  id: string;
  goalId: string;
  title: string;
  weeklyTargetMinutes: number;
  priority: Priority;
  /** Firm deadline (hard constraint). Both fields are set together or both undefined. */
  deadline?: { day: Weekday; time: string };
  splittable: boolean;
  /** Only meaningful when splittable. */
  minSessionMinutes: number;
  /** Optional hard cap on minutes of this task per day. */
  maxMinutesPerDay?: number;
  /** Soft preferences. */
  preferredDays: Weekday[];
  preferredTimeOfDay?: TimeOfDay;
}

export interface AvailabilityWindow {
  id: string;
  day: Weekday;
  startTime: string;
  endTime: string;
}

export interface FixedCommitment {
  id: string;
  title: string;
  recurrence: "weekly" | "once";
  /** Weekly: every selected weekday. Once: derived from `date`, kept for convenience. */
  days: Weekday[];
  startTime: string;
  endTime: string;
  /** Required when recurrence === "once". */
  date?: string;
}

export interface PlanningInput {
  goals: Goal[];
  tasks: Task[];
  availability: AvailabilityWindow[];
  commitments: FixedCommitment[];
  strategy: SchedulingStrategy;
  /** Monday of the planning week, "YYYY-MM-DD". One-off commitments only apply inside this week. */
  weekStart: string;
}

/** What a scheduler engine receives. Identical to PlanningInput by design. */
export type SchedulingInput = PlanningInput;

export type UnscheduledReasonCode =
  | "insufficient-time"
  | "daily-limit"
  | "deadline"
  | "min-session"
  | "invalid-reference"
  | "not-splittable"
  | "other";

export interface ScheduledSession {
  id: string;
  taskId: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  minutes: number;
}

export interface UnscheduledWork {
  taskId: string;
  remainingMinutes: number;
  reasons: { code: UnscheduledReasonCode; message: string }[];
}

/** Where a result came from. UI must show a banner for anything other than "real". */
export type ResultProvenance =
  | { kind: "real"; engine: string }
  | { kind: "demo"; engine: string; notice: string };

export interface ScheduleResult {
  mode: SchedulerMode;
  strategy: SchedulingStrategy;
  provenance: ResultProvenance;
  sessions: ScheduledSession[];
  unscheduled: UnscheduledWork[];
  /** Free-form notes from the engine (shown verbatim). */
  notes: string[];
  generatedAt: string;
}

export interface TaskBreakdown {
  taskId: string;
  title: string;
  goalTitle: string;
  requestedMinutes: number;
  scheduledMinutes: number;
  remainingMinutes: number;
  status: "full" | "partial" | "none";
  deadlineOutcome: "met" | "missed" | "none";
  reasons: string[];
}

export interface ScheduleSummary {
  requestedMinutes: number;
  scheduledMinutes: number;
  unscheduledMinutes: number;
  coveragePercent: number;
  tasksFull: number;
  tasksPartialOrNone: number;
  deadlinesMet: number;
  deadlinesMissed: number;
  tasks: TaskBreakdown[];
}

export interface ValidationIssue {
  id: string;
  step: WizardStepId;
  severity: "error" | "warning";
  message: string;
  /** Entity the issue points at, for inline display. */
  entityId?: string;
  /** "Required field" style issues are only shown after the user tries to continue. */
  deferred?: boolean;
  /** Field the issue belongs to (e.g. "weeklyTargetMinutes"), so editors can show it inline. */
  field?: string;
}

export type WizardStepId = "goals" | "tasks" | "availability" | "preferences" | "review" | "schedule";
