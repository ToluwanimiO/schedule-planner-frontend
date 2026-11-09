import { useCallback, useMemo, useRef, useState } from "react";
import { WIZARD_STEPS } from "../domain/constants";
import { createGoal, createTask, createWindow, defaultAvailability } from "../domain/defaults";
import type {
  AvailabilityWindow, FixedCommitment, Goal, PlanningInput, ScheduleResult, ScheduleSummary,
  SchedulerMode, SchedulingStrategy, Task, ValidationIssue, WizardStepId,
} from "../domain/types";
import { InvalidScheduleError, schedulerAdapter, SchedulerUnavailableError } from "../scheduler/schedulerAdapter";
import { buildSummary } from "../utils/scheduleSummary";
import { errorsOf, validatePlan } from "../utils/scheduleValidation";
import { fromMinutes, mondayOf, todayLocal, toMinutes, weekdayOfDate, addDays } from "../utils/timeUtils";

export type GenerationStatus = "idle" | "loading" | "success" | "error";

export interface GenerationError { message: string; details: string[] }
interface Snapshot { input: PlanningInput; key: string; result: ScheduleResult; summary: ScheduleSummary }

const STEP_IDS = WIZARD_STEPS.map(s => s.id);
const SCHEDULE_INDEX = STEP_IDS.indexOf("schedule");

/**
 * Owns all planning state: entities, wizard navigation, validation and generation.
 * Contains no rendering and no scheduling logic — generation goes through schedulerAdapter.
 */
export function useSchedulePlanner() {
  const [goals, setGoals] = useState<Goal[]>(() => [createGoal()]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [availability, setAvailability] = useState<AvailabilityWindow[]>(defaultAvailability);
  const [commitments, setCommitments] = useState<FixedCommitment[]>([]);
  const [strategy, setStrategy] = useState<SchedulingStrategy>("balanced-progress");
  const [mode, setMode] = useState<SchedulerMode>("greedy");
  const [weekStart, setWeekStartRaw] = useState(() => mondayOf(todayLocal()));

  const [stepIndex, setStepIndex] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [attempted, setAttempted] = useState<ReadonlySet<WizardStepId>>(new Set());

  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState<GenerationError | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const requestId = useRef(0);
  const running = useRef(false);

  const input = useMemo<PlanningInput>(
    () => ({ goals, tasks, availability, commitments, strategy, weekStart }),
    [goals, tasks, availability, commitments, strategy, weekStart],
  );
  const inputKey = useMemo(() => JSON.stringify({ ...input, mode }), [input, mode]);
  const issues = useMemo(() => validatePlan(input), [input]);
  const stale = snapshot !== null && snapshot.key !== inputKey;

  // ---- goals -------------------------------------------------------------------------------
  const addGoal = useCallback(() => { const g = createGoal(); setGoals(c => [...c, g]); return g.id; }, []);
  const updateGoal = useCallback((id: string, title: string) => setGoals(c => c.map(g => (g.id === id ? { ...g, title } : g))), []);
  /** Removes the goal AND its tasks so nothing is left orphaned. The UI asks for confirmation first. */
  const removeGoal = useCallback((id: string) => {
    setGoals(c => c.filter(g => g.id !== id));
    setTasks(c => c.filter(t => t.goalId !== id));
  }, []);

  // ---- tasks -------------------------------------------------------------------------------
  const addTask = useCallback((goalId: string) => { const t = createTask(goalId); setTasks(c => [...c, t]); return t.id; }, []);
  const updateTask = useCallback((id: string, patch: Partial<Task>) => setTasks(c => c.map(t => (t.id === id ? { ...t, ...patch } : t))), []);
  const removeTask = useCallback((id: string) => setTasks(c => c.filter(t => t.id !== id)), []);

  // ---- availability ------------------------------------------------------------------------
  const addWindow = useCallback((day: AvailabilityWindow["day"]) => {
    setAvailability(c => {
      const mine = c.filter(w => w.day === day).map(w => toMinutes(w.endTime)).filter(Number.isFinite);
      if (!mine.length) return [...c, createWindow(day, "09:00", "12:00")];
      const start = Math.max(...mine);
      return start <= 22 * 60 ? [...c, createWindow(day, fromMinutes(start), fromMinutes(Math.min(1440, start + 60)))] : [...c, createWindow(day, "09:00", "10:00")];
    });
  }, []);
  const updateWindow = useCallback((id: string, patch: Partial<AvailabilityWindow>) => setAvailability(c => c.map(w => (w.id === id ? { ...w, ...patch } : w))), []);
  const removeWindow = useCallback((id: string) => setAvailability(c => c.filter(w => w.id !== id)), []);

  // ---- commitments -------------------------------------------------------------------------
  const saveCommitment = useCallback((next: FixedCommitment) => {
    // One-off commitments keep `days` in sync with their date so consumers can rely on either.
    const wd = next.recurrence === "once" ? weekdayOfDate(next.date) : null;
    const normalized = next.recurrence === "once" && wd ? { ...next, days: [wd] } : next;
    setCommitments(c => (c.some(x => x.id === normalized.id) ? c.map(x => (x.id === normalized.id ? normalized : x)) : [...c, normalized]));
  }, []);
  const removeCommitment = useCallback((id: string) => setCommitments(c => c.filter(x => x.id !== id)), []);

  const setWeekStart = useCallback((date: string) => setWeekStartRaw(mondayOf(date)), []);
  const shiftWeek = useCallback((weeks: number) => setWeekStartRaw(w => addDays(w, weeks * 7)), []);

  // ---- validation views --------------------------------------------------------------------
  /** Issues to show on a step. "Required field" issues stay hidden until the user tries to continue. */
  const stepIssues = useCallback(
    (step: WizardStepId): ValidationIssue[] => issues.filter(i => i.step === step && (!i.deferred || attempted.has(step))),
    [issues, attempted],
  );

  // ---- navigation --------------------------------------------------------------------------
  const currentStep = STEP_IDS[stepIndex];
  const goTo = useCallback((index: number) => {
    if (index >= 0 && index <= maxReached && index < STEP_IDS.length) setStepIndex(index);
  }, [maxReached]);
  const back = useCallback(() => setStepIndex(i => Math.max(0, i - 1)), []);

  const markAttempted = (steps: WizardStepId[]) => setAttempted(prev => new Set([...prev, ...steps]));

  /** Advance if the current step has no blocking errors. Returns whether it advanced. */
  const next = useCallback((): boolean => {
    const blocking = errorsOf(issues.filter(i => i.step === currentStep));
    if (blocking.length) { markAttempted([currentStep]); return false; }
    const target = Math.min(stepIndex + 1, SCHEDULE_INDEX - 1);
    setStepIndex(target);
    setMaxReached(m => Math.max(m, target));
    return true;
  }, [issues, currentStep, stepIndex]);

  // ---- generation --------------------------------------------------------------------------
  const generate = useCallback(async () => {
    const blocking = errorsOf(issues);
    if (blocking.length) {
      const firstIdx = Math.min(...blocking.map(i => STEP_IDS.indexOf(i.step)));
      markAttempted([...new Set(blocking.map(i => i.step))]);
      setStepIndex(firstIdx);
      return;
    }
    if (running.current) return; // ignore double clicks
    running.current = true;
    const id = ++requestId.current;
    setStatus("loading"); setError(null); setSnapshot(null);
    setStepIndex(SCHEDULE_INDEX); setMaxReached(SCHEDULE_INDEX);
    try {
      const result = await schedulerAdapter.generate(input, mode);
      if (id !== requestId.current) return;
      setSnapshot({ input, key: inputKey, result, summary: buildSummary(input, result) });
      setStatus("success");
    } catch (e) {
      if (id !== requestId.current) return;
      if (e instanceof InvalidScheduleError) setError({ message: e.message, details: e.violations });
      else if (e instanceof SchedulerUnavailableError) setError({ message: e.message, details: [] });
      else setError({ message: "Something went wrong while generating the timetable.", details: [e instanceof Error ? e.message : String(e)] });
      setStatus("error");
    } finally {
      if (id === requestId.current) running.current = false;
    }
  }, [issues, input, inputKey, mode]);

  const reset = useCallback(() => {
    requestId.current++; running.current = false;
    setGoals([createGoal()]); setTasks([]); setAvailability(defaultAvailability()); setCommitments([]);
    setStrategy("balanced-progress"); setMode("greedy"); setWeekStartRaw(mondayOf(todayLocal()));
    setStepIndex(0); setMaxReached(0); setAttempted(new Set());
    setStatus("idle"); setError(null); setSnapshot(null);
  }, []);

  return {
    // data
    input, goals, tasks, availability, commitments, strategy, mode, weekStart,
    // validation
    issues, stepIssues,
    // navigation
    stepIndex, currentStep, maxReached, goTo, next, back,
    // mutations
    addGoal, updateGoal, removeGoal, addTask, updateTask, removeTask,
    addWindow, updateWindow, removeWindow, saveCommitment, removeCommitment,
    setStrategy, setMode, setWeekStart, shiftWeek, reset,
    // generation
    generate, status, error,
    generated: snapshot ? { input: snapshot.input, result: snapshot.result, summary: snapshot.summary } : null,
    stale,
  };
}

export type SchedulePlanner = ReturnType<typeof useSchedulePlanner>;
