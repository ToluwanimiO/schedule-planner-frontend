import type { ScheduleResult, SchedulerMode, SchedulingInput } from "../domain/types";

/**
 * A scheduling engine turns a validated SchedulingInput into a ScheduleResult.
 * Real engines (greedy, beam-search optimizer) implement this by mapping the frontend
 * domain types to their own types and back — see README → "Connecting your real scheduler".
 */
export interface SchedulerEngine {
  readonly name: string;
  generate(input: SchedulingInput): Promise<ScheduleResult>;
}

export interface SchedulerAdapter {
  generate(input: SchedulingInput, mode: SchedulerMode): Promise<ScheduleResult>;
  /** Which modes have an engine behind them right now. */
  describeModes(): { mode: SchedulerMode; available: boolean; label: string; detail: string }[];
}

export class SchedulerUnavailableError extends Error {
  constructor(public readonly mode: SchedulerMode) {
    super(`The ${mode === "optimizer" ? "optimizer" : "greedy"} scheduler isn’t connected to this frontend yet.`);
    this.name = "SchedulerUnavailableError";
  }
}

/** Thrown when an engine returns a schedule that breaks a hard constraint. The result is discarded. */
export class InvalidScheduleError extends Error {
  constructor(public readonly violations: string[]) {
    super("The scheduler returned a timetable that breaks your hard constraints, so it was discarded.");
    this.name = "InvalidScheduleError";
  }
}
