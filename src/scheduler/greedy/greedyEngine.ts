import type { SchedulerEngine } from "../types";
import { generateGreedySchedule } from "./generateGreedySchedule";
import { fromEngineResult, toEngineInput } from "../mapping";

export const greedyEngine: SchedulerEngine = {
  name: "Greedy scheduler",
  async generate(input) {
    return fromEngineResult(input, generateGreedySchedule(toEngineInput(input)),
    { 
        mode: "greedy", engineLabel: "Greedy scheduler (generateGreedySchedule)", 
        notes: ["Preferred days and times of day aren’t used by this scheduler yet."] 
    });
  },
};