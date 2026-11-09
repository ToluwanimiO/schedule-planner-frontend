import { describe, expect, it } from "vitest";
import { calendarBounds, layoutDay } from "../utils/calendarLayout";

describe("calendar layout", () => {
  it("puts overlapping events side by side and keeps adjacent ones full width", () => {
    const out = layoutDay([{ id: "a", start: 540, end: 600 }, { id: "b", start: 570, end: 630 }, { id: "c", start: 630, end: 660 }]);
    const by = (id: string) => out.find(o => o.item.id === id)!;
    expect([by("a").lane, by("b").lane, by("a").lanes]).toEqual([0, 1, 2]);
    expect(by("c").lanes).toBe(1);
  });
  it("widens the visible range to fit early/late events", () => {
    expect(calendarBounds([{ start: 300, end: 360 }, { start: 1300, end: 1380 }], 360, 1320)).toEqual({ rangeStart: 300, rangeEnd: 1380 });
  });
});
