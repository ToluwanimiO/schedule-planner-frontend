import type { SchedulerMode } from "../domain/types";
import { demoGreedyEngine } from "./demoGreedyEngine";
import type { SchedulerEngine } from "./types";

/**
 * Registry of engines by mode.
 *
 *   greedy    -> DEMO engine (the project did not include the real greedy module)
 *   optimizer -> not connected (the project did not include the beam-search module)
 *
 * To connect the real algorithms, write an adapter object that implements SchedulerEngine
 * (map SchedulingInput -> your engine's input, call it, map its output -> ScheduleResult with
 * provenance { kind: "real", engine: "…" }) and put it here. Nothing in the UI needs to change.
 */
export const engines: Partial<Record<SchedulerMode, SchedulerEngine>> = {
  greedy: demoGreedyEngine,
  // optimizer: realOptimizerEngine,
};
