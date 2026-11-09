/**
 * DEMO ENGINE — NOT YOUR REAL ALGORITHM.
 *
 * The uploaded project contained only a placeholder scheduler (no greedy or beam-search
 * modules), so this small greedy engine exists to let the UI run end to end. Every result it
 * produces is tagged `provenance.kind === "demo"` and the UI shows a banner for it.
 * Replace it by registering your real engine in `engines.ts`.
 */
import { MINUTE_STEP, PRIORITY_RANK, TIME_OF_DAY_RANGE, WEEKDAYS, WEEKDAY_SHORT } from "../domain/constants";
import type {
  ScheduledSession, ScheduleResult, SchedulingInput, Task, UnscheduledReasonCode, UnscheduledWork, Weekday,
} from "../domain/types";
import { freeIntervalsByDay, subtractInterval, type Interval } from "../utils/intervals";
import { formatDuration, formatTime, fromMinutes, toMinutes } from "../utils/timeUtils";
import type { SchedulerEngine } from "./types";

const floorStep = (n: number) => Math.floor(n / MINUTE_STEP) * MINUTE_STEP;

interface State {
  free: Record<Weekday, Interval[]>;
  /** taskId -> day -> minutes already placed */
  usedByDay: Map<string, Map<Weekday, number>>;
  sessionsByDay: Map<string, Map<Weekday, number>>;
  remaining: Map<string, number>;
  placed: { taskId: string; day: Weekday; start: number; end: number }[];
}

/** Latest minute of `day` the task may use (0 means the day is closed to it). */
function dayLimit(task: Task, day: Weekday): number {
  if (!task.deadline) return 1440;
  if (day > task.deadline.day) return 0;
  return day === task.deadline.day ? toMinutes(task.deadline.time) : 1440;
}

const eligible = (task: Task, day: Weekday, st: State): Interval[] => {
  const limit = dayLimit(task, day);
  return st.free[day].map(i => ({ start: i.start, end: Math.min(i.end, limit) })).filter(i => i.end > i.start);
};

const used = (m: Map<string, Map<Weekday, number>>, taskId: string, day: Weekday) => m.get(taskId)?.get(day) ?? 0;
const bump = (m: Map<string, Map<Weekday, number>>, taskId: string, day: Weekday, by: number) => {
  const inner = m.get(taskId) ?? new Map<Weekday, number>();
  inner.set(day, (inner.get(day) ?? 0) + by);
  m.set(taskId, inner);
};

const deadlineAbs = (t: Task) => (t.deadline ? t.deadline.day * 1440 + toMinutes(t.deadline.time) : Number.POSITIVE_INFINITY);

function order(tasks: Task[], strategy: SchedulingInput["strategy"]): Task[] {
  const idx = new Map(tasks.map((t, i) => [t.id, i]));
  const byPriority = (a: Task, b: Task) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || deadlineAbs(a) - deadlineAbs(b) || idx.get(a.id)! - idx.get(b.id)!;
  const byDeadline = (a: Task, b: Task) =>
    (deadlineAbs(a) === deadlineAbs(b) ? 0 : deadlineAbs(a) < deadlineAbs(b) ? -1 : 1) ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || idx.get(a.id)! - idx.get(b.id)!;
  return [...tasks].sort(strategy === "deadline-first" ? byDeadline : byPriority);
}

/** Largest legal session length given a maximum, honouring minimum-session and split rules; 0 if none. */
function chooseAmount(task: Task, remaining: number, maxAmount: number): number {
  if (!task.splittable) return maxAmount >= remaining ? remaining : 0;
  const min = task.minSessionMinutes;
  let a = floorStep(Math.min(maxAmount, remaining));
  if (a < min) return 0;
  const left = remaining - a;
  if (left > 0 && left < min) {
    a = remaining - min; // leave a leftover that can still be a legal session
    if (a < min) return 0;
  }
  return a;
}

function findPlacement(task: Task, wanted: number, st: State, strategy: SchedulingInput["strategy"]) {
  const remaining = st.remaining.get(task.id) ?? 0;
  if (remaining <= 0) return null;
  let best: { day: Weekday; start: number; amount: number; score: number } | null = null;
  for (const day of WEEKDAYS) {
    const capLeft = task.maxMinutesPerDay === undefined ? Infinity : task.maxMinutesPerDay - used(st.usedByDay, task.id, day);
    for (const iv of eligible(task, day, st)) {
      const slots: { start: number; end: number; todMatch: boolean }[] = [];
      if (task.preferredTimeOfDay) {
        const [rs, re] = TIME_OF_DAY_RANGE[task.preferredTimeOfDay];
        const s = Math.max(iv.start, rs), e = Math.min(iv.end, re);
        if (e > s) slots.push({ start: s, end: e, todMatch: true });
      }
      slots.push({ start: iv.start, end: iv.end, todMatch: !task.preferredTimeOfDay });
      for (const slot of slots) {
        const amount = chooseAmount(task, remaining, Math.min(slot.end - slot.start, capLeft, wanted));
        if (amount <= 0) continue;
        let score = day * 1440 + slot.start;
        if (task.preferredDays.length && !task.preferredDays.includes(day)) score += 100000;
        if (task.preferredTimeOfDay && !slot.todMatch) score += 50000;
        if (strategy === "balanced-progress") score += used(st.sessionsByDay, task.id, day) * 3000;
        if (!best || score < best.score) best = { day, start: slot.start, amount, score };
      }
    }
  }
  return best;
}

function commit(task: Task, p: { day: Weekday; start: number; amount: number }, st: State) {
  const iv = { start: p.start, end: p.start + p.amount };
  st.free[p.day] = subtractInterval(st.free[p.day], iv);
  st.remaining.set(task.id, (st.remaining.get(task.id) ?? 0) - p.amount);
  bump(st.usedByDay, task.id, p.day, p.amount);
  bump(st.sessionsByDay, task.id, p.day, 1);
  st.placed.push({ taskId: task.id, day: p.day, start: iv.start, end: iv.end });
}

/** Explain leftover work using only the final free-time state, so every reason is verifiable. */
function diagnose(task: Task, st: State): UnscheduledWork["reasons"] {
  const remaining = st.remaining.get(task.id) ?? 0;
  const reasons: UnscheduledWork["reasons"] = [];
  const push = (code: UnscheduledReasonCode, message: string) => reasons.push({ code, message });
  const minUseful = task.splittable ? task.minSessionMinutes : remaining;
  const blocks = (ivs: Interval[]) => floorStep(Math.max(0, ...ivs.map(i => i.end - i.start)));

  if (task.splittable && remaining < task.minSessionMinutes) {
    push("min-session", `Only ${formatDuration(remaining)} is left, which is shorter than the minimum session of ${formatDuration(task.minSessionMinutes)}.`);
  }
  const capBlocked: Weekday[] = [], fragmented: Weekday[] = [];
  let eligibleTotal = 0, longest = 0;
  for (const day of WEEKDAYS) {
    const ivs = eligible(task, day, st);
    eligibleTotal += ivs.reduce((s, i) => s + i.end - i.start, 0);
    const block = blocks(ivs);
    longest = Math.max(longest, block);
    const capLeft = task.maxMinutesPerDay === undefined ? Infinity : task.maxMinutesPerDay - used(st.usedByDay, task.id, day);
    if (block >= minUseful && capLeft < minUseful) capBlocked.push(day);
    else if (block > 0 && block < minUseful) fragmented.push(day);
  }
  const names = (ds: Weekday[]) => ds.map(d => WEEKDAY_SHORT[d]).join(", ");
  if (capBlocked.length) {
    push("daily-limit", `The daily limit of ${formatDuration(task.maxMinutesPerDay ?? 0)} was reached on ${names(capBlocked)} while free time was still open.`);
  }
  if (fragmented.length) {
    if (task.splittable) push("min-session", `Free gaps on ${names(fragmented)} are shorter than the minimum session of ${formatDuration(task.minSessionMinutes)}.`);
    else push("not-splittable", `This task can’t be split and needs one block of ${formatDuration(remaining)}; the longest free block is ${formatDuration(longest)}.`);
  }
  if (task.deadline) {
    const dl = `${WEEKDAY_SHORT[task.deadline.day]} ${formatTime(task.deadline.time)}`;
    const afterOk = WEEKDAYS.some(day => {
      const limit = dayLimit(task, day);
      return st.free[day].some(i => i.end > limit && i.end - Math.max(i.start, limit) >= minUseful);
    });
    if (eligibleTotal === 0) push("deadline", `No free time is left before the deadline (${dl}).`);
    else if (afterOk) push("deadline", `Free time remains after the deadline (${dl}), but it can’t be used because the deadline is firm.`);
  }
  if (eligibleTotal === 0 && !reasons.some(r => r.code === "deadline")) push("insufficient-time", "No free availability is left for this task after other work and commitments.");
  if (!reasons.length) push("insufficient-time", "Not enough compatible free time remains for this task.");
  return reasons;
}

function mergeAdjacent(placed: State["placed"]): State["placed"] {
  const sorted = [...placed].sort((a, b) => a.day - b.day || a.start - b.start);
  const out: State["placed"] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && last.taskId === p.taskId && last.day === p.day && last.end === p.start) last.end = p.end;
    else out.push({ ...p });
  }
  return out;
}

export function runDemoGreedy(input: SchedulingInput): ScheduleResult {
  const goalIds = new Set(input.goals.map(g => g.id));
  const tasks = input.tasks.filter(t => goalIds.has(t.goalId));
  const invalid = input.tasks.filter(t => !goalIds.has(t.goalId));
  const st: State = {
    free: freeIntervalsByDay(input.availability, input.commitments, input.weekStart),
    usedByDay: new Map(), sessionsByDay: new Map(),
    remaining: new Map(tasks.map(t => [t.id, t.weeklyTargetMinutes])),
    placed: [],
  };
  const ordered = order(tasks, input.strategy);

  if (input.strategy === "balanced-progress") {
    let progress = true, guard = 0;
    while (progress && guard++ < 5000) {
      progress = false;
      for (const t of ordered) {
        const chunk = t.splittable ? Math.max(t.minSessionMinutes, 60) : (st.remaining.get(t.id) ?? 0);
        const p = findPlacement(t, chunk, st, input.strategy);
        if (p) { commit(t, p, st); progress = true; }
      }
    }
  } else {
    for (const t of ordered) {
      let guard = 0;
      for (;;) {
        const p = guard++ < 5000 ? findPlacement(t, st.remaining.get(t.id) ?? 0, st, input.strategy) : null;
        if (!p) break;
        commit(t, p, st);
      }
    }
  }

  const sessions: ScheduledSession[] = mergeAdjacent(st.placed).map((p, i) => ({
    id: `s${i + 1}`, taskId: p.taskId, day: p.day, startTime: fromMinutes(p.start), endTime: fromMinutes(p.end), minutes: p.end - p.start,
  }));
  const unscheduled: UnscheduledWork[] = [];
  for (const t of tasks) {
    const left = st.remaining.get(t.id) ?? 0;
    if (left > 0) unscheduled.push({ taskId: t.id, remainingMinutes: left, reasons: diagnose(t, st) });
  }
  for (const t of invalid) {
    unscheduled.push({ taskId: t.id, remainingMinutes: t.weeklyTargetMinutes, reasons: [{ code: "invalid-reference", message: "This task refers to a goal that doesn’t exist." }] });
  }
  return {
    mode: "greedy",
    strategy: input.strategy,
    provenance: {
      kind: "demo", engine: "Demo greedy scheduler",
      notice: "This timetable comes from a simple built-in demo scheduler, not your real greedy or optimizer algorithm. Use it to check the interface; don’t treat the allocations as your engine’s output.",
    },
    sessions, unscheduled,
    notes: ["Soft preferences (preferred days and time of day) are followed when they don’t prevent a task from being scheduled."],
    generatedAt: new Date().toISOString(),
  };
}

export const demoGreedyEngine: SchedulerEngine = {
  name: "Demo greedy scheduler",
  async generate(input) { return runDemoGreedy(input); },
};
