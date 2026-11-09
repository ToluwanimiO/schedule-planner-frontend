import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  COMMITMENT_SWATCH, DEFAULT_CALENDAR_END, DEFAULT_CALENDAR_START, PRIORITY_LABEL, STRATEGIES, STRATEGY_LABEL,
  TIME_OF_DAY_LABEL, WEEKDAYS, WEEKDAY_NAMES, WEEKDAY_SHORT, goalSwatch,
} from "../domain/constants";
import type { PlanningInput, ScheduleResult, ScheduleSummary, TaskBreakdown } from "../domain/types";
import { calendarBounds, layoutDay } from "./calendarLayout";
import { describeCommitment, expandCommitments } from "./commitments";
import {
  dateForWeekday, formatDate, formatDays, formatDuration, formatRange, formatTime, formatWeekRange, fromMinutes, toMinutes,
} from "./timeUtils";

/**
 * Generates the weekly planning report as a real PDF (jsPDF + jspdf-autotable).
 * Input is the same { input, result, summary } the UI renders, so the report and the screen cannot differ.
 * `buildSchedulePdf` is pure (returns the document) so it can be tested; `exportSchedulePdf` also saves it.
 */
export interface PdfSource { input: PlanningInput; result: ScheduleResult; summary: ScheduleSummary }
export interface PdfBuild { doc: jsPDF; filename: string; simplifiedText: boolean }

const PAGE_W = 297, PAGE_H = 210, M = 12, FOOTER_H = 10;
const INK: RGB = [32, 37, 31], MUTED: RGB = [100, 107, 97], GREEN: RGB = [51, 91, 69], GREEN_DARK: RGB = [35, 69, 50];
const LINE: RGB = [221, 224, 214], CREAM: RGB = [247, 247, 242], AMBER_BG: RGB = [251, 242, 231], AMBER: RGB = [128, 92, 56];
type RGB = [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---- text safety: jsPDF's built-in fonts only cover WinAnsi (Latin-1 + a few symbols) ----
const EXTRA_OK = new Set([0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac, 0x2122]);
const isWinAnsi = (c: number) => (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || EXTRA_OK.has(c);

/** Keeps supported characters, strips accents from unsupported letters (ọ → o), and uses “?” as a last resort. */
export function toPdfText(input: string): { text: string; simplified: boolean } {
  let simplified = false;
  let out = "";
  for (const ch of input.replace(/[\r\n\t]+/g, " ")) {
    const code = ch.codePointAt(0)!;
    if (isWinAnsi(code)) { out += ch; continue; }
    simplified = true;
    const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    out += [...base].every(c => isWinAnsi(c.codePointAt(0)!)) && base ? base : "?";
  }
  return { text: out, simplified };
}

export function pdfFilename(weekStart: string): string {
  return `weekly-plan-${weekStart}.pdf`;
}

export function buildSchedulePdf({ input, result, summary }: PdfSource): PdfBuild {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let simplifiedText = false;
  /** All user-provided text passes through here. */
  const t = (s: string) => { const r = toPdfText(s); if (r.simplified) simplifiedText = true; return r.text; };

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (size: number, style: "normal" | "bold" | "italic" = "normal") => { doc.setFont("helvetica", style); doc.setFontSize(size); };
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? M;
  const ensure = (y: number, needed: number) => { if (y + needed > PAGE_H - FOOTER_H - 4) { doc.addPage(); return M; } return y; };
  const heading = (text: string, y: number) => { font(13, "bold"); color(GREEN_DARK); doc.text(t(text), M, y); return y + 5; };

  const goalTitle = new Map(input.goals.map(g => [g.id, t(g.title.trim())]));
  const weekLabel = formatWeekRange(input.weekStart);
  const strategy = STRATEGIES.find(s => s.id === result.strategy);

  const tableBase = {
    margin: { left: M, right: M, top: M, bottom: FOOTER_H + 4 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, textColor: INK, lineColor: LINE, lineWidth: 0.2, overflow: "linebreak" as const, valign: "middle" as const },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255] as RGB, fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: CREAM },
    showHead: "everyPage" as const,
    rowPageBreak: "avoid" as const,
  };

  // ================= Page 1: overview =================
  font(24, "bold"); color(GREEN_DARK); doc.text("My Weekly Plan", M, M + 8);
  font(12); color(INK); doc.text(`Week of ${weekLabel}`, M, M + 15);
  font(9); color(MUTED);
  const engineLabel = result.provenance.engine;
  doc.text(t(`Strategy: ${STRATEGY_LABEL[result.strategy]}  ·  Engine: ${result.mode === "greedy" ? "Greedy" : "Optimizer"} (${engineLabel})  ·  Generated ${formatDate(result.generatedAt.slice(0, 10))}`), M, M + 20.5);

  let y = M + 25;
  if (result.provenance.kind === "demo") {
    const lines = doc.splitTextToSize(t(`Demo result: ${result.provenance.notice}`), PAGE_W - 2 * M - 8) as string[];
    const h = lines.length * 4.4 + 5;
    fill(AMBER_BG); stroke([241, 224, 199]); doc.roundedRect(M, y, PAGE_W - 2 * M, h, 1.5, 1.5, "FD");
    font(9, "normal"); color(AMBER); doc.text(lines, M + 4, y + 5.2);
    y += h + 4;
  }

  // stat tiles
  const tiles: [string, string][] = [
    ["Requested", formatDuration(summary.requestedMinutes)],
    ["Scheduled", formatDuration(summary.scheduledMinutes)],
    ["Unscheduled", formatDuration(summary.unscheduledMinutes)],
    ["Work coverage", `${summary.coveragePercent}%`],
    ["Tasks fully scheduled", `${summary.tasksFull} of ${summary.tasks.length}`],
  ];
  const gap = 4, tileW = (PAGE_W - 2 * M - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach(([label, value], i) => {
    const x = M + i * (tileW + gap);
    fill([255, 255, 255]); stroke(LINE); doc.roundedRect(x, y, tileW, 20, 1.8, 1.8, "FD");
    font(18, "bold"); color(GREEN); doc.text(value, x + 4, y + 10);
    font(9); color(MUTED); doc.text(label, x + 4, y + 16);
  });
  y += 24;
  // coverage bar
  fill([230, 233, 224]); doc.roundedRect(M, y, PAGE_W - 2 * M, 3, 1.5, 1.5, "F");
  if (summary.coveragePercent > 0) { fill(GREEN); doc.roundedRect(M, y, Math.max(3, ((PAGE_W - 2 * M) * summary.coveragePercent) / 100), 3, 1.5, 1.5, "F"); }
  y += 8;
  font(10); color(INK);
  const dl = summary.deadlinesMet + summary.deadlinesMissed;
  doc.text(
    `${summary.tasksFull} of ${summary.tasks.length} tasks fully scheduled; ${summary.tasksPartialOrNone} partly or not scheduled.` +
      (dl ? `  Deadlines: ${summary.deadlinesMet} met, ${summary.deadlinesMissed} missed.` : ""),
    M, y,
  );
  y += 8;

  y = heading("Scheduling approach", y);
  font(9.5); color(INK);
  const approach = doc.splitTextToSize(t(`${strategy?.label ?? ""}: ${strategy?.description ?? ""}`), PAGE_W - 2 * M) as string[];
  doc.text(approach, M, y); y += approach.length * 4.4 + 1;
  font(9.5, "bold"); doc.text("Hard constraints (never broken): ", M, y);
  font(9.5); doc.text("availability windows, fixed commitments, firm deadlines, minimum sessions, daily maximums, no-split tasks.", M + 56, y); y += 5;
  font(9.5, "bold"); doc.text("Soft preferences (followed when possible): ", M, y);
  font(9.5); doc.text("preferred days and times of day, and the strategy above.", M + 68, y); y += 6;

  autoTable(doc, {
    ...tableBase, startY: y,
    head: [["Task", "Goal", "Priority", "Deadline", "Splitting", "Max per day", "Preferred days", "Preferred time"]],
    body: input.tasks.map(task => [
      t(task.title.trim()), goalTitle.get(task.goalId) ?? "Unknown goal", PRIORITY_LABEL[task.priority],
      task.deadline ? `${WEEKDAY_SHORT[task.deadline.day]} ${formatTime(task.deadline.time)}` : "None",
      task.splittable ? `Yes, min ${formatDuration(task.minSessionMinutes)}` : "One block only",
      task.maxMinutesPerDay !== undefined ? formatDuration(task.maxMinutesPerDay) : "No limit",
      task.preferredDays.length ? formatDays(task.preferredDays, "short") : "Any day",
      task.preferredTimeOfDay ? TIME_OF_DAY_LABEL[task.preferredTimeOfDay] : "Any time",
    ]),
    columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 48 } },
  });

  // ================= Calendar page =================
  doc.addPage();
  font(15, "bold"); color(GREEN_DARK); doc.text(`Weekly timetable · ${weekLabel}`, M, M + 5);

  interface Ev { id: string; kind: "work" | "fixed"; title: string; start: number; end: number; day: number; sw: { bg: string; border: string; text: string } }
  const taskById = new Map(input.tasks.map(x => [x.id, x]));
  const events: Ev[] = [
    ...result.sessions.filter(s => taskById.has(s.taskId)).map(s => ({
      id: s.id, kind: "work" as const, title: t(taskById.get(s.taskId)!.title.trim()), start: toMinutes(s.startTime), end: toMinutes(s.endTime),
      day: s.day, sw: goalSwatch(input.goals, taskById.get(s.taskId)!.goalId),
    })),
    ...expandCommitments(input.commitments, input.weekStart).map(o => ({
      id: `${o.commitmentId}-${o.day}`, kind: "fixed" as const, title: t(o.title.trim() || "Commitment"), start: o.startMinute, end: o.endMinute, day: o.day, sw: COMMITMENT_SWATCH,
    })),
  ];
  const { rangeStart, rangeEnd } = calendarBounds(events, DEFAULT_CALENDAR_START, DEFAULT_CALENDAR_END);
  const hours = (rangeEnd - rangeStart) / 60;

  // legend (top right)
  font(8.5); color(INK);
  const lx = PAGE_W - M - 92;
  fill(hex(goalSwatch(input.goals, input.goals[0]?.id ?? "").bg)); stroke(hex(goalSwatch(input.goals, input.goals[0]?.id ?? "").border));
  doc.setLineWidth(0.3); doc.rect(lx, M + 2, 5, 3.5, "FD"); doc.text("Work session (colour = goal)", lx + 7, M + 5);
  fill(hex(COMMITMENT_SWATCH.bg)); stroke(hex(COMMITMENT_SWATCH.border)); doc.setLineDashPattern([0.8, 0.8], 0);
  doc.rect(lx + 52, M + 2, 5, 3.5, "FD"); doc.setLineDashPattern([], 0); doc.text("Fixed commitment", lx + 59, M + 5);

  const timeW = 14, headH = 9, top = M + 9;
  const colW = (PAGE_W - 2 * M - timeW) / 7;
  const bodyTop = top + headH;
  const bodyH = PAGE_H - FOOTER_H - 7 - bodyTop;
  const hourH = Math.min(14, bodyH / hours);
  const gridH = hourH * hours;

  // header
  fill(GREEN); doc.rect(M + timeW, top, colW * 7, headH, "F");
  WEEKDAYS.forEach((d, i) => {
    const x = M + timeW + i * colW;
    font(9.5, "bold"); color([255, 255, 255]); doc.text(WEEKDAY_SHORT[d], x + colW / 2, top + 4, { align: "center" });
    font(8); doc.text(formatDate(dateForWeekday(input.weekStart, d), false), x + colW / 2, top + 7.6, { align: "center" });
  });
  // grid
  stroke(LINE); doc.setLineWidth(0.2);
  for (let i = 0; i <= hours; i++) {
    const gy = bodyTop + i * hourH;
    doc.line(M + timeW, gy, M + timeW + colW * 7, gy);
    if (i > 0 && i < hours) {
      const h = (rangeStart + i * 60) / 60;
      font(8); color(MUTED); doc.text(formatTime(`${String(h).padStart(2, "0")}:00`), M + timeW - 1.5, gy + 1, { align: "right" });
    }
  }
  for (let i = 0; i <= 7; i++) doc.line(M + timeW + i * colW, bodyTop, M + timeW + i * colW, bodyTop + gridH);

  let unlabeled = 0;
  WEEKDAYS.forEach((d, di) => {
    const x0 = M + timeW + di * colW;
    for (const { item: e, lane, lanes } of layoutDay(events.filter(ev => ev.day === d))) {
      const ex = x0 + 0.6 + (lane * (colW - 1.2)) / lanes, ew = (colW - 1.2) / lanes - 0.4;
      const ey = bodyTop + ((e.start - rangeStart) / 60) * hourH + 0.3;
      const eh = ((e.end - e.start) / 60) * hourH - 0.6;
      fill(hex(e.sw.bg)); stroke(hex(e.sw.border)); doc.setLineWidth(0.3);
      if (e.kind === "fixed") doc.setLineDashPattern([0.8, 0.8], 0);
      doc.roundedRect(ex, ey, ew, eh, 0.8, 0.8, "FD");
      doc.setLineDashPattern([], 0);
      // Text: bold title then time, only as many lines as fit. 7pt ≈ 3 mm line height.
      const maxLines = Math.floor((eh - 1.2) / 3);
      if (maxLines < 1) { unlabeled++; continue; }
      font(7.5, "bold"); color(hex(e.sw.text));
      const titleLines = doc.splitTextToSize((e.kind === "fixed" ? "Fixed: " : "") + e.title, ew - 2) as string[];
      const lines: { text: string; bold: boolean }[] = titleLines.slice(0, Math.max(1, maxLines - (maxLines > 1 ? 1 : 0))).map(x => ({ text: x, bold: true }));
      if (titleLines.length > lines.length) lines[lines.length - 1].text = lines[lines.length - 1].text.replace(/.{0,2}$/, "...");
      if (lines.length < maxLines) lines.push({ text: formatRange(fromMinutes(e.start), fromMinutes(e.end)), bold: false });
      lines.forEach((ln, i) => { font(7.5, ln.bold ? "bold" : "normal"); doc.text(ln.text, ex + 1, ey + 3 + i * 3); });
    }
  });
  if (unlabeled > 0) {
    font(8); color(MUTED);
    doc.text("Blocks too short to label here are listed in the session table that follows.", M, PAGE_H - FOOTER_H - 2);
  }

  // ================= Sessions =================
  doc.addPage();
  let sy = heading("Work sessions", M + 5);
  const sessions = [...result.sessions].filter(s => taskById.has(s.taskId)).sort((a, b) => a.day - b.day || toMinutes(a.startTime) - toMinutes(b.startTime));
  if (!sessions.length) {
    font(10); color(INK); doc.text("No work sessions were scheduled.", M, sy + 2); sy += 8;
  } else {
    autoTable(doc, {
      ...tableBase, startY: sy,
      head: [["Day", "Time", "Task", "Goal", "Length"]],
      body: sessions.map(s => {
        const task = taskById.get(s.taskId)!;
        return [`${WEEKDAY_NAMES[s.day]}, ${formatDate(dateForWeekday(input.weekStart, s.day), false)}`, formatRange(s.startTime, s.endTime), t(task.title.trim()), goalTitle.get(task.goalId) ?? "Unknown goal", formatDuration(s.minutes)];
      }),
      columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 40 }, 4: { cellWidth: 22 } },
    });
    sy = lastY() + 8;
  }

  sy = ensure(sy, 30);
  sy = heading("Fixed commitments", sy);
  if (!input.commitments.length) { font(10); color(INK); doc.text("No fixed commitments.", M, sy + 2); sy += 8; }
  else {
    autoTable(doc, {
      ...tableBase, startY: sy,
      head: [["Commitment", "When"]],
      body: input.commitments.map(c => [t(c.title.trim() || "Untitled"), t(describeCommitment(c))]),
      columnStyles: { 0: { cellWidth: 80 } },
    });
    sy = lastY() + 8;
  }

  // ================= Task breakdown =================
  sy = ensure(sy, 40);
  sy = heading("Task breakdown: scheduled versus requested", sy);
  const statusText: Record<TaskBreakdown["status"], string> = { full: "Fully scheduled", partial: "Partly scheduled", none: "Not scheduled" };
  const deadlineText: Record<TaskBreakdown["deadlineOutcome"], string> = { met: "Met", missed: "Missed", none: "–" };
  if (!summary.tasks.length) { font(10); color(INK); doc.text("No tasks were planned.", M, sy + 2); sy += 8; }
  else {
    autoTable(doc, {
      ...tableBase, startY: sy,
      head: [["Task", "Goal", "Requested", "Scheduled", "Remaining", "Status", "Deadline"]],
      body: summary.tasks.map(x => [t(x.title), t(x.goalTitle), formatDuration(x.requestedMinutes), formatDuration(x.scheduledMinutes), formatDuration(x.remainingMinutes), statusText[x.status], deadlineText[x.deadlineOutcome]]),
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 50 } },
      foot: [["Total", "", formatDuration(summary.requestedMinutes), formatDuration(summary.scheduledMinutes), formatDuration(summary.unscheduledMinutes), `${summary.coveragePercent}% covered`, ""]],
      footStyles: { fillColor: [234, 240, 233] as RGB, textColor: GREEN_DARK, fontStyle: "bold" as const },
      showFoot: "lastPage",
    });
    sy = lastY() + 8;
  }

  // ================= Unscheduled =================
  sy = ensure(sy, 36);
  sy = heading("Unscheduled work", sy);
  const left = summary.tasks.filter(x => x.remainingMinutes > 0);
  if (!left.length) { font(10); color(INK); doc.text("Everything you requested fits this week.", M, sy + 2); }
  else {
    autoTable(doc, {
      ...tableBase, startY: sy,
      head: [["Task", "Time left", "Reasons reported by the scheduler"]],
      body: left.map(x => [t(x.title), `${formatDuration(x.remainingMinutes)} of ${formatDuration(x.requestedMinutes)}`, x.reasons.length ? x.reasons.map(r => `• ${t(r)}`).join("\n") : "No reason was reported."]),
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 38 } },
    });
  }

  // ================= Footer on every page =================
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(LINE); doc.setLineWidth(0.2); doc.line(M, PAGE_H - FOOTER_H, PAGE_W - M, PAGE_H - FOOTER_H);
    font(8.5); color(MUTED);
    doc.text(`My Weekly Plan · ${weekLabel}`, M, PAGE_H - 5);
    doc.text(`Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 5, { align: "right" });
  }
  return { doc, filename: pdfFilename(input.weekStart), simplifiedText };
}

/** Builds the PDF and triggers a browser download. Throws a readable Error on failure. */
export async function exportSchedulePdf(source: PdfSource): Promise<{ filename: string; simplifiedText: boolean }> {
  try {
    const { doc, filename, simplifiedText } = buildSchedulePdf(source);
    doc.save(filename);
    return { filename, simplifiedText };
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Unexpected error while building the PDF");
  }
}
