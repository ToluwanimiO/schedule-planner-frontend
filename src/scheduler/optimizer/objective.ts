
import type {
  SchedulingInput,
  ScheduledSession,
  Task,
} from "../engineTypes";

export const OBJECTIVE_WEIGHTS = {
  deadlineSuccess: 0.40,
  workCoverage: 0.30,
  priorityAlignment: 0.20,
  preferenceSatisfaction: 0.10,
} as const;

export type ObjectiveMetrics = {
  deadlineSuccess: number;
  workCoverage: number;
  priorityAlignment: number;
  preferenceSatisfaction: number;
  score: number;
};

function sessionMinutes(session: ScheduledSession): number {
  return session.endMinute - session.startMinute;
}

function getTimeOfDay(
  minute: number,
): "morning" | "afternoon" | "evening" | "other" {
  if (minute >= 5 * 60 && minute < 12 * 60) return "morning";
  if (minute >= 12 * 60 && minute < 17 * 60) return "afternoon";
  if (minute >= 17 * 60 && minute < 22 * 60) return "evening";
  return "other";
}

function matchesPreferences(
  task: Task,
  session: ScheduledSession,
): number {
  const hasDayPreference = Boolean(task.preferredDays?.length);
  const hasTimePreference = Boolean(task.preferredTimeOfDay?.length);

  if (!hasDayPreference && !hasTimePreference) return 1;

  let matchingMinutes = 0;
  const duration = sessionMinutes(session);

  for (let minute = session.startMinute; minute < session.endMinute; minute++) {
    const dayMatches =
      !hasDayPreference || task.preferredDays!.includes(session.day);

    const timeMatches =
      !hasTimePreference ||
      task.preferredTimeOfDay!.includes(getTimeOfDay(minute));

    if (dayMatches && timeMatches) matchingMinutes++;
  }

  return duration > 0 ? matchingMinutes / duration : 0;
}

export function scoreSchedule(
  input: SchedulingInput,
  sessions: ScheduledSession[],
): ObjectiveMetrics {
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const scheduledByTask = new Map<string, number>();

  let totalScheduled = 0;
  let priorityWeightedMinutes = 0;
  let preferenceMatchingMinutes = 0;

  for (const session of sessions) {
    const task = taskById.get(session.taskId);
    if (!task) continue;

    const minutes = sessionMinutes(session);
    if (minutes <= 0) continue;

    totalScheduled += minutes;
    priorityWeightedMinutes += task.priority * minutes;

    scheduledByTask.set(
      task.id,
      (scheduledByTask.get(task.id) ?? 0) + minutes,
    );

    preferenceMatchingMinutes +=
      minutes * matchesPreferences(task, session);
  }

  // D: priority-weighted proportion of deadline tasks completed on time.
  const deadlineTasks = input.tasks.filter((task) => task.deadline);
  const totalDeadlineWeight = deadlineTasks.reduce(
    (sum, task) => sum + Math.max(0, task.priority),
    0,
  );

  const completedDeadlineWeight = deadlineTasks.reduce((sum, task) => {
    const scheduledMinutes = scheduledByTask.get(task.id) ?? 0;
    const fullyScheduled = scheduledMinutes >= task.weeklyTargetMinutes;

    const finishesOnTime = sessions
      .filter((session) => session.taskId === task.id)
      .every(
        (session) =>
          session.day < task.deadline!.day ||
          (session.day === task.deadline!.day &&
            session.endMinute <= task.deadline!.minuteOfDay),
      );

    return sum + (
      fullyScheduled && finishesOnTime
        ? Math.max(0, task.priority)
        : 0
    );
  }, 0);

  const deadlineSuccess =
    totalDeadlineWeight === 0
      ? 1
      : completedDeadlineWeight / totalDeadlineWeight;

  // W: proportion of requested work minutes scheduled.
  const totalRequested = input.tasks.reduce(
    (sum, task) => sum + task.weeklyTargetMinutes,
    0,
  );

  const workCoverage =
    totalRequested === 0
      ? 1
      : Math.min(1, totalScheduled / totalRequested);

  // P: average priority of scheduled minutes, normalized to max priority.
  const maxPriority = Math.max(0, ...input.tasks.map((task) => task.priority));

  const priorityAlignment =
    totalScheduled === 0
      ? 0
      : maxPriority === 0
        ? 0
        : Math.min(
            1,
            priorityWeightedMinutes / (maxPriority * totalScheduled),
          );

  // F: fraction of scheduled minutes matching all specified preferences.
  const preferenceSatisfaction =
    totalScheduled === 0
      ? (input.tasks.some(
          (task) =>
            task.preferredDays?.length ||
            task.preferredTimeOfDay?.length,
        )
          ? 0
          : 1)
      : preferenceMatchingMinutes / totalScheduled;

  const score =
    100 *
    (
      OBJECTIVE_WEIGHTS.deadlineSuccess * deadlineSuccess +
      OBJECTIVE_WEIGHTS.workCoverage * workCoverage +
      OBJECTIVE_WEIGHTS.priorityAlignment * priorityAlignment +
      OBJECTIVE_WEIGHTS.preferenceSatisfaction * preferenceSatisfaction
    );

  return {
    deadlineSuccess,
    workCoverage,
    priorityAlignment,
    preferenceSatisfaction,
    score,
  };
}
