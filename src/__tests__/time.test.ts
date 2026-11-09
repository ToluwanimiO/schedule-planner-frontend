import { describe, expect, it } from "vitest";
import { addDays, formatDays, formatDuration, formatTime, formatWeekRange, fromMinutes, mondayOf, parseDate, toMinutes, weekdayOfDate } from "../utils/timeUtils";

describe("timeUtils", () => {
  it("converts between HH:mm and minutes", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("24:00")).toBe(1440);
    expect(Number.isNaN(toMinutes("25:00"))).toBe(true);
    expect(fromMinutes(570)).toBe("09:30");
    expect(fromMinutes(1440)).toBe("24:00");
  });
  it("formats 12-hour times and durations", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:15")).toBe("12:15 PM");
    expect(formatTime("18:00")).toBe("6:00 PM");
    expect(formatTime("24:00")).toBe("12:00 AM");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(45)).toBe("45m");
  });
  it("uses ISO weekdays (Mon=1 … Sun=7)", () => {
    expect(weekdayOfDate("2026-11-09")).toBe(1);
    expect(weekdayOfDate("2026-11-15")).toBe(7);
    expect(mondayOf("2026-11-13")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(parseDate("2026-02-31")).toBeNull();
  });
  it("describes day selections", () => {
    expect(formatDays([3, 2])).toBe("Tuesday, Wednesday");
    expect(formatDays([1, 2, 3, 4, 5, 6, 7])).toBe("Every day");
    expect(formatDays([1, 2, 3, 4, 5])).toContain("Weekdays");
    expect(formatDays([6, 7])).toContain("Weekends");
    expect(formatWeekRange("2026-11-09")).toBe("9 Nov – 15 Nov 2026");
  });
});
