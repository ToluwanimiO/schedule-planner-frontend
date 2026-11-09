import { describe, expect, it } from "vitest";
import type { FixedCommitment } from "../domain/types";
import { describeCommitment, expandCommitments } from "../utils/commitments";
import { freeIntervalsByDay } from "../utils/intervals";
import { WEEK, win } from "./fixtures";

const weekly = (days: FixedCommitment["days"], over: Partial<FixedCommitment> = {}): FixedCommitment => ({
  id: "c1", title: "Choir", recurrence: "weekly", days, startTime: "18:00", endTime: "19:00", ...over,
});

describe("recurring and one-off commitments", () => {
  it("applies one weekly commitment to every selected weekday without duplicating data", () => {
    const occ = expandCommitments([weekly([2, 3])], WEEK);
    expect(occ.map(o => o.day)).toEqual([2, 3]);
    expect(occ.map(o => o.date)).toEqual(["2026-11-10", "2026-11-11"]);
  });
  it("supports every day, weekdays and weekends selections", () => {
    expect(expandCommitments([weekly([1, 2, 3, 4, 5, 6, 7])], WEEK)).toHaveLength(7);
    expect(expandCommitments([weekly([1, 2, 3, 4, 5])], WEEK)).toHaveLength(5);
    expect(expandCommitments([weekly([6, 7])], WEEK).map(o => o.day)).toEqual([6, 7]);
  });
  it("applies a one-off commitment only on its date, and only inside the planning week", () => {
    const once = weekly([], { recurrence: "once", date: "2026-11-12" });
    expect(expandCommitments([once], WEEK).map(o => o.day)).toEqual([4]);
    expect(expandCommitments([once], "2026-11-16")).toHaveLength(0);
  });
  it("ignores invalid time ranges (including overnight)", () => {
    expect(expandCommitments([weekly([1], { startTime: "22:00", endTime: "01:00" })], WEEK)).toHaveLength(0);
  });
  it("describes selected days and times for lists", () => {
    expect(describeCommitment(weekly([2, 3]))).toBe("Tuesday, Wednesday · 6:00 PM–7:00 PM");
  });
  it("removes commitment time from availability on the right days only", () => {
    const free = freeIntervalsByDay([win(2, "09:00", "20:00"), win(3, "09:00", "20:00"), win(4, "09:00", "20:00")], [weekly([2, 3])], WEEK);
    expect(free[2]).toEqual([{ start: 540, end: 1080 }, { start: 1140, end: 1200 }]);
    expect(free[3]).toEqual(free[2]);
    expect(free[4]).toEqual([{ start: 540, end: 1200 }]);
  });
});
