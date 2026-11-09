import type {
  FixedCommitment,
  SchedulingInput,
  SchedulingResult,
  ScheduledSession,
  Task,
  TaskAllocation,
  TimeWindow,
  UnscheduledReason,
  Weekday,
} from "../engineTypes";

type FreeWindow = TimeWindow & { day: Weekday };

const DAY_START = 0;
const DAY_END = 1440;

function assertIntegerInRange(
  value: number,
  min: number,
  max: number,
  label: string,
): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }
}

export function validateInput(input: SchedulingInput): void {
  const goalIds = new Set(input.goals.map((goal) => goal.id));
  const taskIds = new Set<string>();

  for (const task of input.tasks) {
    if (taskIds.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
    taskIds.add(task.id);

    if (!goalIds.has(task.goalId)) {
      throw new Error(`Task "${task.id}" references an unknown goal.`);
    }
    if (
      !Number.isInteger(task.weeklyTargetMinutes) ||
      task.weeklyTargetMinutes <= 0
    ) {
      throw new Error(
        `Task "${task.id}" must have a positive integer weekly target.`,
      );
    }
    if (
      !Number.isInteger(task.priority) ||
      task.priority < 1 ||
      task.priority > 5
    ) {
      throw new Error(
        `Task "${task.id}" priority must be an integer from 1 to 5.`,
      );
    }
    if (
      !Number.isInteger(task.minSessionMinutes) ||
      task.minSessionMinutes <= 0
    ) {
      throw new Error(
        `Task "${task.id}" must have a positive minimum session.`,
      );
    }
    if (task.minSessionMinutes > task.weeklyTargetMinutes) {
      throw new Error(
        `Task "${task.id}" minimum session exceeds its weekly target.`,
      );
    }
    if (
      task.maxMinutesPerDay !== undefined &&
      (!Number.isInteger(task.maxMinutesPerDay) || task.maxMinutesPerDay <= 0)
    ) {
      throw new Error(
        `Task "${task.id}" daily maximum must be a positive integer.`,
      );
    }
    if (task.deadline) {
      assertIntegerInRange(
        task.deadline.day,
        1,
        7,
        `Task "${task.id}" deadline day`,
      );
      assertIntegerInRange(
        task.deadline.minuteOfDay,
        0,
        1439,
        `Task "${task.id}" deadline time`,
      );
    }
  }

  for (const entry of input.availability) {
    assertIntegerInRange(entry.day, 1, 7, "Availability day");
    const windows = [...entry.windows].sort(
      (a, b) => a.startMinute - b.startMinute,
    );
    for (const window of windows) {
      assertIntegerInRange(
        window.startMinute,
        DAY_START,
        DAY_END,
        "Availability start",
      );
      assertIntegerInRange(
        window.endMinute,
        DAY_START,
        DAY_END,
        "Availability end",
      );
      if (window.startMinute >= window.endMinute) {
        throw new Error("Availability windows must have positive duration.");
      }
    }
    for (let i = 1; i < windows.length; i++) {
      if (windows[i].startMinute < windows[i - 1].endMinute) {
        throw new Error(
          `Availability windows overlap on weekday ${entry.day}.`,
        );
      }
    }
  }

  for (const commitment of input.fixedCommitments) {
    assertIntegerInRange(
      commitment.startMinute,
      DAY_START,
      DAY_END,
      "Commitment start",
    );
    assertIntegerInRange(
      commitment.endMinute,
      DAY_START,
      DAY_END,
      "Commitment end",
    );
    if (commitment.startMinute >= commitment.endMinute) {
      throw new Error(
        `Commitment "${commitment.id}" must have positive duration.`,
      );
    }
    for (const day of commitment.days)
      assertIntegerInRange(day, 1, 7, "Commitment day");
  }
}

function subtractCommitments(
  window: TimeWindow,
  commitments: FixedCommitment[],
): TimeWindow[] {
  let remaining: TimeWindow[] = [{ ...window }];

  for (const commitment of commitments) {
    const next: TimeWindow[] = [];
    for (const segment of remaining) {
      if (
        commitment.endMinute <= segment.startMinute ||
        commitment.startMinute >= segment.endMinute
      ) {
        next.push(segment);
        continue;
      }

      if (commitment.startMinute > segment.startMinute) {
        next.push({
          startMinute: segment.startMinute,
          endMinute: commitment.startMinute,
        });
      }
      if (commitment.endMinute < segment.endMinute) {
        next.push({
          startMinute: commitment.endMinute,
          endMinute: segment.endMinute,
        });
      }
    }
    remaining = next;
  }

  return remaining.filter((segment) => segment.startMinute < segment.endMinute);
}

function buildFreeWindows(input: SchedulingInput): FreeWindow[] {
  const result: FreeWindow[] = [];

  for (const availability of input.availability) {
    const commitments = input.fixedCommitments.filter((item) =>
      item.days.includes(availability.day),
    );

    for (const window of availability.windows) {
      for (const free of subtractCommitments(window, commitments)) {
        result.push({ ...free, day: availability.day });
      }
    }
  }

  return result.sort((a, b) => a.day - b.day || a.startMinute - b.startMinute);
}

function compareDeadlines(a: Task, b: Task): number {
  if (!a.deadline && !b.deadline) return 0;
  if (!a.deadline) return 1;
  if (!b.deadline) return -1;
  return (
    a.deadline.day - b.deadline.day ||
    a.deadline.minuteOfDay - b.deadline.minuteOfDay
  );
}

function orderTasks(
  tasks: Task[],
  strategy: SchedulingInput["preferences"]["strategy"],
): Task[] {
  const copy = [...tasks];

  if (strategy === "priority-first") {
    return copy.sort(
      (a, b) =>
        b.priority - a.priority ||
        compareDeadlines(a, b) ||
        a.id.localeCompare(b.id),
    );
  }

  if (strategy === "deadline-first") {
    return copy.sort(
      (a, b) =>
        compareDeadlines(a, b) ||
        b.priority - a.priority ||
        a.id.localeCompare(b.id),
    );
  }

  // Balanced mode uses repeated rounds, handled by the scheduler.
  return copy.sort(
    (a, b) =>
      b.priority - a.priority ||
      compareDeadlines(a, b) ||
      a.id.localeCompare(b.id),
  );
}

function isAfterDeadline(day: Weekday, endMinute: number, task: Task): boolean {
  if (!task.deadline) return false;
  return (
    day > task.deadline.day ||
    (day === task.deadline.day && endMinute > task.deadline.minuteOfDay)
  );
}

function taskReasons(
  task: Task,
  scheduledMinutes: number,
  freeWindows: FreeWindow[],
  dailyMinutes: Map<string, number>,
): UnscheduledReason[] {
  if (scheduledMinutes >= task.weeklyTargetMinutes) return [];

  const reasons = new Set<UnscheduledReason>();
  const eligibleWindows = freeWindows.filter((window) => {
    if (task.deadline && window.day > task.deadline.day) return false;
    return true;
  });

  if (task.deadline && eligibleWindows.length === 0) {
    reasons.add("deadline-passed");
  }

  if (
    task.maxMinutesPerDay !== undefined &&
    [...dailyMinutes.entries()].some(
      ([key, minutes]) =>
        key.startsWith(`${task.id}:`) && minutes >= task.maxMinutesPerDay!,
    )
  ) {
    reasons.add("daily-limit-reached");
  }

  const maxWindow = eligibleWindows.reduce((max, window) => {
    const end =
      task.deadline && window.day === task.deadline.day
        ? Math.min(window.endMinute, task.deadline.minuteOfDay)
        : window.endMinute;
    return Math.max(max, end - window.startMinute);
  }, 0);

  if (maxWindow > 0 && maxWindow < task.minSessionMinutes) {
    reasons.add("session-too-short");
  }

  if (reasons.size === 0) reasons.add("insufficient-availability");
  return [...reasons];
}

function allocateOneSession(
  task: Task,
  windows: FreeWindow[],
  sessions: ScheduledSession[],
  dailyMinutes: Map<string, number>,
  maxSessionMinutes?: number,
): number {
  const alreadyScheduled = sessions
    .filter((session) => session.taskId === task.id)
    .reduce((sum, session) => sum + session.endMinute - session.startMinute, 0);
  const remainingWeekly = task.weeklyTargetMinutes - alreadyScheduled;
  if (remainingWeekly <= 0) return 0;

  for (let i = 0; i < windows.length; i++) {
    const window = windows[i];
    if (task.deadline && window.day > task.deadline.day) continue;

    const dayKey = `${task.id}:${window.day}`;
    const usedToday = dailyMinutes.get(dayKey) ?? 0;
    const dailyRemaining =
      task.maxMinutesPerDay === undefined
        ? Number.POSITIVE_INFINITY
        : task.maxMinutesPerDay - usedToday;
    if (dailyRemaining <= 0) continue;

    const deadlineEnd =
      task.deadline && window.day === task.deadline.day
        ? Math.min(window.endMinute, task.deadline.minuteOfDay)
        : window.endMinute;
    const available = deadlineEnd - window.startMinute;
    if (available <= 0) continue;

    if (!task.splittable) {
      // An unsplittable task is one uninterrupted block equal to its remaining target.
      if (
        alreadyScheduled > 0 ||
        remainingWeekly < task.weeklyTargetMinutes ||
        available < remainingWeekly ||
        dailyRemaining < remainingWeekly
      ) {
        continue;
      }

      const duration = remainingWeekly;
      sessions.push({
        id: `${task.id}-${sessions.length + 1}`,
        taskId: task.id,
        day: window.day,
        startMinute: window.startMinute,
        endMinute: window.startMinute + duration,
      });
      dailyMinutes.set(dayKey, usedToday + duration);
      windows[i] = { ...window, startMinute: window.startMinute + duration };
      if (windows[i].startMinute >= windows[i].endMinute) windows.splice(i, 1);
      return duration;
    }
    const allocationLimit = maxSessionMinutes ?? Infinity;
    const wouldLeaveTooLittleTime =
      remainingWeekly > allocationLimit &&
      remainingWeekly - allocationLimit < task.minSessionMinutes;

    const duration = Math.min(
      remainingWeekly,
      dailyRemaining,
      available,
      wouldLeaveTooLittleTime ? remainingWeekly : allocationLimit,
    );
    if (duration < task.minSessionMinutes) continue;

    sessions.push({
      id: `${task.id}-${sessions.length + 1}`,
      taskId: task.id,
      day: window.day,
      startMinute: window.startMinute,
      endMinute: window.startMinute + duration,
    });
    dailyMinutes.set(dayKey, usedToday + duration);
    windows[i] = { ...window, startMinute: window.startMinute + duration };
    if (windows[i].startMinute >= windows[i].endMinute) windows.splice(i, 1);
    return duration;
  }

  return 0;
}

function allocateTaskFully(
  task: Task,
  windows: FreeWindow[],
  sessions: ScheduledSession[],
  dailyMinutes: Map<string, number>,
): void {
  while (true) {
    const allocated = allocateOneSession(task, windows, sessions, dailyMinutes);
    if (allocated === 0) return;

    const total = sessions
      .filter((session) => session.taskId === task.id)
      .reduce(
        (sum, session) => sum + session.endMinute - session.startMinute,
        0,
      );
    if (total >= task.weeklyTargetMinutes || !task.splittable) return;
  }
}

export function validateSchedule(
  input: SchedulingInput,
  sessions: ScheduledSession[],
): string[] {
  const errors: string[] = [];
  const tasks = new Map(input.tasks.map((task) => [task.id, task]));
  const daily = new Map<string, number>();

  for (const session of sessions) {
    const task = tasks.get(session.taskId);
    if (!task) {
      errors.push(`Session "${session.id}" references an unknown task.`);
      continue;
    }

    if (
      !Number.isInteger(session.startMinute) ||
      !Number.isInteger(session.endMinute) ||
      session.startMinute < 0 ||
      session.endMinute > DAY_END ||
      session.startMinute >= session.endMinute
    ) {
      errors.push(`Session "${session.id}" has an invalid time interval.`);
      continue;
    }

    if (isAfterDeadline(session.day, session.endMinute, task)) {
      errors.push(
        `Session "${session.id}" exceeds task "${task.id}" deadline.`,
      );
    }

    const duration = session.endMinute - session.startMinute;
    const dayKey = `${task.id}:${session.day}`;
    daily.set(dayKey, (daily.get(dayKey) ?? 0) + duration);

    const available = input.availability
      .filter((entry) => entry.day === session.day)
      .flatMap((entry) => entry.windows)
      .some(
        (window) =>
          session.startMinute >= window.startMinute &&
          session.endMinute <= window.endMinute,
      );

    if (!available)
      errors.push(`Session "${session.id}" is outside availability.`);

    const overlapsCommitment = input.fixedCommitments.some(
      (commitment) =>
        commitment.days.includes(session.day) &&
        session.startMinute < commitment.endMinute &&
        session.endMinute > commitment.startMinute,
    );
    if (overlapsCommitment)
      errors.push(`Session "${session.id}" overlaps a fixed commitment.`);
  }

  const byDay = new Map<Weekday, ScheduledSession[]>();
  for (const session of sessions) {
    byDay.set(session.day, [...(byDay.get(session.day) ?? []), session]);
  }
  for (const [day, daySessions] of byDay) {
    const sorted = [...daySessions].sort(
      (a, b) => a.startMinute - b.startMinute,
    );
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startMinute < sorted[i - 1].endMinute) {
        errors.push(`Sessions overlap on weekday ${day}.`);
      }
    }
  }

  for (const task of input.tasks) {
    const taskSessions = sessions.filter(
      (session) => session.taskId === task.id,
    );
    const total = taskSessions.reduce(
      (sum, session) => sum + session.endMinute - session.startMinute,
      0,
    );
    if (total > task.weeklyTargetMinutes) {
      errors.push(`Task "${task.id}" exceeds its weekly target.`);
    }

    if (!task.splittable && taskSessions.length > 1) {
      errors.push(`Unsplittable task "${task.id}" has multiple sessions.`);
    }

    for (const session of taskSessions) {
      if (session.endMinute - session.startMinute < task.minSessionMinutes) {
        errors.push(
          `Task "${task.id}" has a session shorter than its minimum.`,
        );
      }
    }

    if (task.maxMinutesPerDay !== undefined) {
      for (const [key, minutes] of daily) {
        if (key.startsWith(`${task.id}:`) && minutes > task.maxMinutesPerDay) {
          errors.push(`Task "${task.id}" exceeds its daily limit.`);
        }
      }
    }
  }

  return errors;
}

export function generateGreedySchedule(
  input: SchedulingInput,
): SchedulingResult {
  validateInput(input);

  const windows = buildFreeWindows(input);
  const sessions: ScheduledSession[] = [];
  const dailyMinutes = new Map<string, number>();
  const strategy = input.preferences.strategy;
  const orderedTasks = orderTasks(input.tasks, strategy);

  if (strategy === "balanced-progress") {
    // One session per task per round; lower completion ratios get considered first.
    let madeProgress = true;
    while (madeProgress) {
      madeProgress = false;
      const ranked = [...orderedTasks].sort((a, b) => {
        const getRatio = (task: Task) => {
          const scheduled = sessions
            .filter((s) => s.taskId === task.id)
            .reduce((sum, s) => sum + s.endMinute - s.startMinute, 0);
          return scheduled / task.weeklyTargetMinutes;
        };
        return (
          getRatio(a) - getRatio(b) ||
          b.priority - a.priority ||
          compareDeadlines(a, b)
        );
      });

      for (const task of ranked) {
        const before = sessions.length;
        allocateOneSession(
          task,
          windows,
          sessions,
          dailyMinutes,
          task.minSessionMinutes,
        );
        if (sessions.length > before) madeProgress = true;
      }
    }
  } else {
    for (const task of orderedTasks) {
      allocateTaskFully(task, windows, sessions, dailyMinutes);
    }
  }

  sessions.sort((a, b) => a.day - b.day || a.startMinute - b.startMinute);

  const allocations: TaskAllocation[] = input.tasks.map((task) => {
    const scheduledMinutes = sessions
      .filter((session) => session.taskId === task.id)
      .reduce(
        (sum, session) => sum + session.endMinute - session.startMinute,
        0,
      );
    const remainingMinutes = task.weeklyTargetMinutes - scheduledMinutes;
    const status =
      remainingMinutes === 0
        ? "complete"
        : scheduledMinutes > 0
          ? "partial"
          : "unscheduled";

    const reasons: UnscheduledReason[] =
      remainingMinutes > 0
        ? taskReasons(task, scheduledMinutes, windows, dailyMinutes)
        : [];

    return {
      taskId: task.id,
      requestedMinutes: task.weeklyTargetMinutes,
      scheduledMinutes,
      remainingMinutes,
      status,
      reasons,
    };
  });

  const totalRequestedMinutes = input.tasks.reduce(
    (sum, task) => sum + task.weeklyTargetMinutes,
    0,
  );
  const totalScheduledMinutes = sessions.reduce(
    (sum, session) => sum + session.endMinute - session.startMinute,
    0,
  );
  const errors = validateSchedule(input, sessions);

  if (errors.length > 0) {
    throw new Error(
      `Generated schedule violates constraints:\n${errors.join("\n")}`,
    );
  }

  return {
    sessions,
    allocations,
    metrics: {
      totalRequestedMinutes,
      totalScheduledMinutes,
      completionRatio:
        totalRequestedMinutes === 0
          ? 1
          : totalScheduledMinutes / totalRequestedMinutes,
      hardConstraintViolations: errors.length,
    },
  };
}
