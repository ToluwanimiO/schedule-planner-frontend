import type { SchedulerEngine } from "../types";
import { validateInput } from "../greedy/generateGreedySchedule";
import { MAX_SEARCH_STEPS } from "./generateOptimizedSchedule";
import type { SchedulingResult } from "../engineTypes";
import { fromEngineResult, toEngineInput } from "../mapping";

type Reply = { ok: true; result: SchedulingResult } | { ok: false; message: string };

export const optimizerEngine: SchedulerEngine = {
  name: "Beam-search optimizer",
  async generate(input) {
    const engineInput = toEngineInput(input);
    validateInput(engineInput);                       // the optimizer doesn't validate on its own
    const res = await new Promise<SchedulingResult>((resolve, reject) => {
      const worker = new Worker(new URL("./optimizerWorker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<Reply>) => {
        worker.terminate();
        e.data.ok ? resolve(e.data.result) : reject(new Error(e.data.message));
      };
      worker.onerror = e => { worker.terminate(); reject(new Error(e.message || "The optimizer stopped unexpectedly.")); };
      worker.postMessage(engineInput);
    });
    const notes = ["Beam search is a heuristic. It explores many candidate schedules but does not guarantee the best possible one."];
    if (res.sessions.length >= MAX_SEARCH_STEPS) {
      notes.push(`The search adds one session per step and stopped at its ${MAX_SEARCH_STEPS}-step limit, so some work may be unscheduled only because of that limit.`);
    }
    return fromEngineResult(input, res, { mode: "optimizer", engineLabel: "Beam-search optimizer (generateOptimizedSchedule)", notes });
  },
};