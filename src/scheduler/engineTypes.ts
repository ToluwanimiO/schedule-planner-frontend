export type Id = string;
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type MinuteOfDay = number;

export type TimeWindow = {
  startMinute: MinuteOfDay;
  endMinute: MinuteOfDay;
};

export type Goal = {
  id: Id;
  title: string;
  description?: string;
};

export type Task = {
  id: Id;
  goalId: Id;
  title: string;
  weeklyTargetMinutes: number;
  maxMinutesPerDay?: number;
  priority: number;
  deadline?: {
    day: Weekday;
    minuteOfDay: MinuteOfDay;
  };
  splittable: boolean;
  minSessionMinutes: number;
  preferredDays?: Weekday[];
  preferredTimeOfDay?: ("morning" | "afternoon" | "evening" | "other")[];
};

export type WeeklyAvailability = {
  day: Weekday;
  windows: TimeWindow[];
};

export type FixedCommitment = {
  id: Id;
  title: string;
  days: Weekday[];
  startMinute: MinuteOfDay;
  endMinute: MinuteOfDay;
};

export type SchedulingStrategy =
  | "priority-first"
  | "deadline-first"
  | "balanced-progress";

export type SchedulingPreferences = {
  strategy: SchedulingStrategy;
};

export type SchedulingInput = {
  goals: Goal[];
  tasks: Task[];
  availability: WeeklyAvailability[];
  fixedCommitments: FixedCommitment[];
  preferences: SchedulingPreferences;
};

export type ScheduledSession = {
  id: Id;
  taskId: Id;
  day: Weekday;
  startMinute: MinuteOfDay;
  endMinute: MinuteOfDay;
};

export type UnscheduledReason =
  | "insufficient-availability"
  | "deadline-passed"
  | "session-too-short"
  | "daily-limit-reached"
  | "allocation-not-selected";

export type TaskAllocation = {
  taskId: Id;
  requestedMinutes: number;
  scheduledMinutes: number;
  remainingMinutes: number;
  status: "complete" | "partial" | "unscheduled";
  reasons: UnscheduledReason[];
};

export type SchedulingResult = {
  sessions: ScheduledSession[];
  allocations: TaskAllocation[];
  metrics: {
    totalRequestedMinutes: number;
    totalScheduledMinutes: number;
    completionRatio: number;
    hardConstraintViolations: number;
  };
};
