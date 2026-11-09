import { describe, expect, it } from "vitest";
import { runDemoGreedy } from "../scheduler/demoGreedyEngine";
import { buildSummary } from "../utils/scheduleSummary";
import { buildSchedulePdf, pdfFilename, toPdfText } from "../utils/exportSchedulePdf";
import { plan, task, win } from "./fixtures";

function build(input = plan()) {
  const result = runDemoGreedy(input);
  return buildSchedulePdf({ input, result, summary: buildSummary(input, result) });
}
const bytes = (b: ReturnType<typeof build>) => new Uint8Array(b.doc.output("arraybuffer"));
const header = (u: Uint8Array) => String.fromCharCode(...u.slice(0, 5));

describe("PDF export", () => {
  it("creates a real PDF with the planning date in the filename", () => {
    const b = build();
    expect(header(bytes(b))).toBe("%PDF-");
    expect(b.filename).toBe("weekly-plan-2026-11-09.pdf");
    expect(pdfFilename("2026-11-09")).toBe("weekly-plan-2026-11-09.pdf");
  });
  it("is landscape A4 with multiple pages (overview, calendar, tables)", () => {
    const b = build();
    expect(b.doc.internal.pageSize.getWidth()).toBeGreaterThan(b.doc.internal.pageSize.getHeight());
    expect(b.doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
  });
  it("handles unscheduled work, long titles and many tasks (spans pages)", () => {
    const tasks = Array.from({ length: 40 }, (_, i) => task({ id: `t${i}`, title: `Task ${i} ${"very long title ".repeat(8)}`, weeklyTargetMinutes: 120 }));
    const b = build(plan({ tasks, availability: [win(1, "09:00", "12:00")] }));
    expect(b.doc.getNumberOfPages()).toBeGreaterThan(4);
    expect(header(bytes(b))).toBe("%PDF-");
  });
  it("handles an empty timetable", () => {
    expect(header(bytes(build(plan({ availability: [] }))))).toBe("%PDF-");
  });
  it("simplifies characters the built-in font can't draw, and says so", () => {
    expect(toPdfText("Ọ̀rọ̀ café")).toEqual({ text: "Oro café", simplified: true });
    expect(toPdfText("Plain – text").simplified).toBe(false);
    expect(build(plan({ tasks: [task({ id: "y", title: "Ẹ kú iṣẹ́" })] })).simplifiedText).toBe(true);
  });
});
