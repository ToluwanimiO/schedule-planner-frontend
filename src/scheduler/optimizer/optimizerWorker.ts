import { generateOptimizedSchedule } from "./generateOptimizedSchedule";
import type { SchedulingInput } from "../engineTypes";

self.onmessage = (e: MessageEvent<SchedulingInput>) => {
  try { self.postMessage({ ok: true, result: generateOptimizedSchedule(e.data) }); }
  catch (err) { self.postMessage({ ok: false, message: err instanceof Error ? err.message : String(err) }); }
};