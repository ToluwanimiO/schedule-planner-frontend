import type { SchedulerMode, ScheduleResult, SchedulingInput } from "../domain/types";
import { engines } from "./engines";
import { InvalidScheduleError, SchedulerUnavailableError, type SchedulerAdapter } from "./types";
import { verifyResult } from "./verifyResult";

export { InvalidScheduleError, SchedulerUnavailableError } from "./types";
export type { SchedulerAdapter, SchedulerEngine } from "./types";

/**
 * The only door between the UI and any scheduling code.
 * - Picks the engine for the requested mode (no silent fallback to a different algorithm).
 * - Verifies the engine's output against the hard constraints and rejects invalid results.
 */
export const schedulerAdapter: SchedulerAdapter = {
  async generate(input: SchedulingInput, mode: SchedulerMode): Promise<ScheduleResult> {
    const engine = engines[mode];
    if (!engine) throw new SchedulerUnavailableError(mode);
    const result = await engine.generate(input);
    const violations = verifyResult(input, result);
    if (violations.length) throw new InvalidScheduleError(violations);
    return result;
  },
  describeModes() {
    return (["greedy", "optimizer"] as const).map(mode => {
      const engine = engines[mode];
      return {
        mode,
        available: !!engine,
        label: mode === "greedy" ? "Greedy scheduler" : "Optimizer (beam search)",
        detail: engine ? engine.name : "Not connected yet",
      };
    });
  },
};
