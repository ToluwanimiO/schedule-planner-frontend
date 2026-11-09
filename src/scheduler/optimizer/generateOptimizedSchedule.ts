
import type {
  SchedulingInput,
  SchedulingResult,
  ScheduledSession,
  Task,
  TaskAllocation,
  UnscheduledReason,
  Weekday,
} from "../engineTypes";

import { validateSchedule } from "../greedy/generateGreedySchedule";
import { scoreSchedule } from "./objective";

const SLOT_MINUTES = 30;
const BEAM_WIDTH = 80;
export const MAX_SEARCH_STEPS = 30;

type FreeWindow = {
  day: Weekday;
  startMinute: number;
  endMinute: number;
};

type SearchState = {
  sessions: ScheduledSession[];
  score: number;
  scheduledMinutes: number;
  deadlineSuccess: number;
  workCoverage: number;
};

function duration(session: ScheduledSession): number {
  return session.endMinute - session.startMinute;
}

function totalMinutes(sessions: ScheduledSession[]): number {
  return sessions.reduce((sum, session) => sum + duration(session), 0);
}

function scheduledForTask(
  sessions: ScheduledSession[],
  taskId: string,
): number {
  return sessions
    .filter((session) => session.taskId === taskId)
    .reduce((sum, session) => sum + duration(session), 0);
}

function dailyMinutesForTask(
  sessions: ScheduledSession[],
  taskId: string,
  day: Weekday,
): number {
  return sessions
    .filter(
      (session) =>
        session.taskId === taskId && session.day === day,
    )
    .reduce((sum, session) => sum + duration(session), 0);
}

function overlaps(
  startMinute: number,
  endMinute: number,
  otherStart: number,
  otherEnd: number,
): boolean {
  return startMinute < otherEnd && endMinute > otherStart;
}

/**
 * Remove fixed commitments from each availability window.
 * This ensures the optimizer never proposes time occupied by
 * a recurring commitment.
 */
function buildFreeWindows(input: SchedulingInput): FreeWindow[] {
  const freeWindows: FreeWindow[] = [];

  for (const availability of input.availability) {
    for (const window of availability.windows) {
      let segments = [
        {
          startMinute: window.startMinute,
          endMinute: window.endMinute,
        },
      ];

      const commitments = input.fixedCommitments.filter((commitment) =>
        commitment.days.includes(availability.day),
      );

      for (const commitment of commitments) {
        const nextSegments: typeof segments = [];

        for (const segment of segments) {
          if (
            !overlaps(
              segment.startMinute,
              segment.endMinute,
              commitment.startMinute,
              commitment.endMinute,
            )
          ) {
            nextSegments.push(segment);
            continue;
          }

          if (segment.startMinute < commitment.startMinute) {
            nextSegments.push({
              startMinute: segment.startMinute,
              endMinute: commitment.startMinute,
            });
          }

          if (segment.endMinute > commitment.endMinute) {
            nextSegments.push({
              startMinute: commitment.endMinute,
              endMinute: segment.endMinute,
            });
          }
        }

        segments = nextSegments;
      }

      for (const segment of segments) {
        if (segment.startMinute < segment.endMinute) {
          freeWindows.push({
            day: availability.day,
            ...segment,
          });
        }
      }
    }
  }

  return freeWindows.sort(
    (a, b) =>
      a.day - b.day || a.startMinute - b.startMinute,
  );
}

/**
 * Return possible sessions for one task in the current partial schedule.
 * Candidate starts use 30-minute boundaries. Durations are generally
 * multiples of 30, with the exact remaining target also considered.
 */

function generateCandidates(
  task: Task,
  sessions: ScheduledSession[],
  freeWindows: FreeWindow[],
): ScheduledSession[] {
  const alreadyScheduled = scheduledForTask(sessions, task.id);
  const remaining = task.weeklyTargetMinutes - alreadyScheduled;

  if (remaining <= 0) return [];

  const candidates: ScheduledSession[] = [];

  for (const window of freeWindows) {
    const dailyAlreadyScheduled = dailyMinutesForTask(
      sessions,
      task.id,
      window.day,
    );

    const dailyRemaining =
      task.maxMinutesPerDay === undefined
        ? Number.POSITIVE_INFINITY
        : task.maxMinutesPerDay - dailyAlreadyScheduled;

    if (dailyRemaining <= 0) continue;

    // Respect the task's deadline.
    let windowEnd = window.endMinute;

    if (task.deadline) {
      if (window.day > task.deadline.day) continue;

      if (window.day === task.deadline.day) {
        windowEnd = Math.min(
          windowEnd,
          task.deadline.minuteOfDay,
        );
      }
    }

    // Try every 30-minute start position in this free window.
    const firstStart =
      Math.ceil(window.startMinute / SLOT_MINUTES) * SLOT_MINUTES;

    for (
      let startMinute = firstStart;
      startMinute < windowEnd;
      startMinute += SLOT_MINUTES
    ) {
      const availableMinutes = windowEnd - startMinute;

      const maximumDuration = Math.min(
        remaining,
        dailyRemaining,
        availableMinutes,
      );

      if (maximumDuration < task.minSessionMinutes) continue;

      // An unsplittable task must fit entirely into one session.
      if (!task.splittable) {
        if (
          alreadyScheduled > 0 ||
          remaining > dailyRemaining ||
          remaining > availableMinutes
        ) {
          continue;
        }

        const endMinute = startMinute + remaining;

        const hasOverlap = sessions.some(
          (session) =>
            session.day === window.day &&
            overlaps(
              startMinute,
              endMinute,
              session.startMinute,
              session.endMinute,
            ),
        );

        if (hasOverlap) continue;

        candidates.push({
          id: `${task.id}-${window.day}-${startMinute}-${endMinute}`,
          taskId: task.id,
          day: window.day,
          startMinute,
          endMinute,
        });

        continue;
      }

      // Generate possible durations for this particular start time.
      const minimumDuration =
        Math.ceil(task.minSessionMinutes / SLOT_MINUTES) *
        SLOT_MINUTES;

      const possibleDurations = new Set<number>();

      for (
        let minutes =
          Math.floor(maximumDuration / SLOT_MINUTES) * SLOT_MINUTES;
        minutes >= minimumDuration;
        minutes -= SLOT_MINUTES
      ) {
        possibleDurations.add(minutes);
      }

      // Also allow the exact remaining target when it fits.
      if (
        remaining <= maximumDuration &&
        remaining >= task.minSessionMinutes
      ) {
        possibleDurations.add(remaining);
      }

      for (const sessionDuration of possibleDurations) {
        const endMinute = startMinute + sessionDuration;

        if (endMinute > windowEnd) continue;

        const hasOverlap = sessions.some(
          (session) =>
            session.day === window.day &&
            overlaps(
              startMinute,
              endMinute,
              session.startMinute,
              session.endMinute,
            ),
        );

        if (hasOverlap) continue;

        candidates.push({
          id: `${task.id}-${window.day}-${startMinute}-${endMinute}`,
          taskId: task.id,
          day: window.day,
          startMinute,
          endMinute,
        });
      }
    }
  }

  return candidates;
}


function makeState(
  input: SchedulingInput,
  sessions: ScheduledSession[],
): SearchState {
  const sortedSessions = [...sessions].sort(
    (a, b) =>
      a.day - b.day || a.startMinute - b.startMinute,
  );

  const metrics = scoreSchedule(input, sortedSessions);

  return {
    sessions: sortedSessions,
    score: metrics.score,
    scheduledMinutes: totalMinutes(sortedSessions),
    deadlineSuccess: metrics.deadlineSuccess,
    workCoverage: metrics.workCoverage,
  };
}

function stateKey(state: SearchState): string {
  return state.sessions
    .map(
      (session) =>
        `${session.taskId}:${session.day}:` +
        `${session.startMinute}-${session.endMinute}`,
    )
    .sort()
    .join("|");
}

function compareStates(a: SearchState, b: SearchState): number {
  // 1. Prefer higher deadline success.
  if (a.deadlineSuccess !== b.deadlineSuccess) {
    return b.deadlineSuccess - a.deadlineSuccess;
  }

  // 2. Prefer higher work coverage.
  if (a.workCoverage !== b.workCoverage) {
    return b.workCoverage - a.workCoverage;
  }

  // 3. If both are equivalent, prefer the higher weighted score.
  return b.score - a.score;
}

function createAllocations(
  input: SchedulingInput,
  sessions: ScheduledSession[],
): TaskAllocation[] {
  return input.tasks.map((task) => {
    const scheduledMinutes = scheduledForTask(
      sessions,
      task.id,
    );

    const remainingMinutes = Math.max(
      0,
      task.weeklyTargetMinutes - scheduledMinutes,
    );

    let reasons: UnscheduledReason[] = [];

    if (remainingMinutes > 0) {
      if (
        task.deadline &&
        !sessions.some(
          (session) =>
            session.taskId === task.id &&
            (session.day < task.deadline!.day ||
              (session.day === task.deadline!.day &&
                session.endMinute <=
                  task.deadline!.minuteOfDay)),
        )
      ) {
        reasons.push("deadline-passed");
      }

      if (
        task.maxMinutesPerDay !== undefined &&
        sessions.some(
          (session) =>
            session.taskId === task.id &&
            dailyMinutesForTask(
              sessions,
              task.id,
              session.day,
            ) >= task.maxMinutesPerDay!,
        )
      ) {
        reasons.push("daily-limit-reached");
      }

      if (reasons.length === 0) {
        reasons.push("allocation-not-selected");
      }
    }

    return {
      taskId: task.id,
      requestedMinutes: task.weeklyTargetMinutes,
      scheduledMinutes,
      remainingMinutes,
      status:
        remainingMinutes === 0
          ? "complete"
          : scheduledMinutes > 0
            ? "partial"
            : "unscheduled",
      reasons,
    };
  });
}

/**
 * Bounded beam-search optimizer.
 *
 * It repeatedly expands candidate schedules by adding one feasible
 * session, ranks the candidates using the weighted objective function,
 * and retains only the best BEAM_WIDTH candidates at each step.
 */
export function generateOptimizedSchedule(
  input: SchedulingInput,
): SchedulingResult {
  const freeWindows = buildFreeWindows(input);

  let beam: SearchState[] = [makeState(input, [])];
  let bestState = beam[0];

  for (let step = 0; step < MAX_SEARCH_STEPS; step++) {
    const nextStates = new Map<string, SearchState>();

    for (const state of beam) {
      for (const task of input.tasks) {
        const candidates = generateCandidates(
          task,
          state.sessions,
          freeWindows,
        );

        for (const candidate of candidates) {
          const sessions = [...state.sessions, candidate];

          // Reject any candidate that violates a hard constraint.
          if (validateSchedule(input, sessions).length > 0) {
            continue;
          }

          const nextState = makeState(input, sessions);
          const key = stateKey(nextState);

          const existing = nextStates.get(key);

          if (
            !existing ||
            compareStates(nextState, existing) < 0
          ) {
            nextStates.set(key, nextState);
          }
        }
      }
    }

    if (nextStates.size === 0) break;

    beam = [...nextStates.values()]
      .sort(compareStates)
      .slice(0, BEAM_WIDTH);

    if (compareStates(beam[0], bestState) < 0) {
      bestState = beam[0];
    }

    // Stop early if every task's weekly target has been scheduled.
    const allComplete = input.tasks.every(
      (task) =>
        scheduledForTask(bestState.sessions, task.id) >=
        task.weeklyTargetMinutes,
    );

    if (allComplete) break;
  }

  const sessions = bestState.sessions;
  const errors = validateSchedule(input, sessions);

  if (errors.length > 0) {
    throw new Error(
      `Optimizer produced an invalid schedule:\n${errors.join("\n")}`,
    );
  }

  const totalRequestedMinutes = input.tasks.reduce(
    (sum, task) => sum + task.weeklyTargetMinutes,
    0,
  );

  const totalScheduledMinutes = totalMinutes(sessions);

  return {
    sessions,
    allocations: createAllocations(input, sessions),
    metrics: {
      totalRequestedMinutes,
      totalScheduledMinutes,
      completionRatio:
        totalRequestedMinutes === 0
          ? 1
          : totalScheduledMinutes / totalRequestedMinutes,
      hardConstraintViolations: 0,
    },
  };
}
