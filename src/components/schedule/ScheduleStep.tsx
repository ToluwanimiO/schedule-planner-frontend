import { useState } from "react";
import { AlertCircle, AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Download, Info, List, Loader2, RefreshCw } from "lucide-react";
import { STRATEGY_LABEL } from "../../domain/constants";
import type { PlanningInput, ScheduleResult, ScheduleSummary as Summary } from "../../domain/types";
import type { GenerationError, GenerationStatus } from "../../hooks/useSchedulePlanner";
import { formatDuration, formatWeekRange } from "../../utils/timeUtils";
import { AgendaView } from "./AgendaView";
import { ScheduleSummary } from "./ScheduleSummary";
import { UnscheduledTasks } from "./UnscheduledTasks";
import { WeekCalendar } from "./WeekCalendar";

interface Props {
  status: GenerationStatus;
  error: GenerationError | null;
  generated: { input: PlanningInput; result: ScheduleResult; summary: Summary } | null;
  stale: boolean;
  onGenerate: () => void;
  onEditPlan: () => void;
}

type View = "calendar" | "agenda";
const initialView = (): View => (typeof window !== "undefined" && window.matchMedia?.("(max-width: 720px)").matches ? "agenda" : "calendar");

export function ScheduleStep({ status, error, generated, stale, onGenerate, onEditPlan }: Props) {
  const [view, setView] = useState<View>(initialView);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<{ kind: "error" | "info" | "success"; text: string } | null>(null);

  async function download() {
    if (!generated || exporting || stale) return;
    setExporting(true); setExportNote(null);
    try {
      // Loaded on demand so the PDF library doesn't slow the first page load.
      const { exportSchedulePdf } = await import("../../utils/exportSchedulePdf");
      const { filename, simplifiedText } = await exportSchedulePdf(generated);
      setExportNote({
        kind: simplifiedText ? "info" : "success",
        text: simplifiedText
          ? `Saved ${filename}. Some characters aren’t supported by the PDF’s built-in font, so accents or symbols in a few titles were simplified in the PDF (your plan on screen is unchanged).`
          : `Saved ${filename}.`,
      });
    } catch (e) {
      setExportNote({ kind: "error", text: `The PDF couldn’t be created: ${e instanceof Error ? e.message : "unknown error"}. Your timetable is unchanged — please try again.` });
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="step-content" aria-labelledby="schedule-heading" aria-busy={status === "loading"}>
      <p className="step-kicker"><CalendarDays size={16} aria-hidden="true" /> Your week, mapped out</p>
      <h2 id="schedule-heading">Your timetable</h2>

      {status === "loading" && (
        <div className="state-box" role="status"><Loader2 className="spin" size={26} aria-hidden="true" /><strong>Building your timetable…</strong><span>This usually takes a moment.</span></div>
      )}

      {status === "error" && error && (
        <div className="state-box error" role="alert">
          <AlertCircle size={26} aria-hidden="true" />
          <strong>We couldn’t produce a timetable</strong>
          <span>{error.message}</span>
          {error.details.length > 0 && <ul className="violation-list">{error.details.slice(0, 8).map(d => <li key={d}>{d}</li>)}{error.details.length > 8 && <li>…and {error.details.length - 8} more.</li>}</ul>}
          <div className="state-actions">
            <button type="button" className="secondary-button" onClick={onEditPlan}><ArrowLeft size={16} aria-hidden="true" /> Back to review</button>
            <button type="button" className="primary-button" onClick={onGenerate}><RefreshCw size={16} aria-hidden="true" /> Try again</button>
          </div>
        </div>
      )}

      {status === "idle" && (
        <div className="state-box"><strong>No timetable yet</strong><span>Review your plan, then generate it.</span>
          <div className="state-actions"><button type="button" className="primary-button" onClick={onGenerate}>Generate timetable</button></div></div>
      )}

      {status === "success" && generated && (
        <>
          <p className="step-intro">
            Week of {formatWeekRange(generated.input.weekStart)} · {STRATEGY_LABEL[generated.result.strategy]} strategy · {generated.result.mode === "greedy" ? "greedy" : "optimizer"} engine
          </p>

          {generated.result.provenance.kind === "demo" && (
            <div className="notice warning" role="note"><Info size={18} aria-hidden="true" /><div><strong>Demo result</strong><p>{generated.result.provenance.notice}</p></div></div>
          )}
          {stale && (
            <div className="notice warning" role="status">
              <AlertTriangle size={18} aria-hidden="true" />
              <div><strong>Your plan has changed since this timetable was made.</strong><p>Regenerate to see an up-to-date timetable. PDF download is paused until then so the report always matches a current plan.</p></div>
            </div>
          )}

          <div className="result-headline" role="status">
            {generated.result.sessions.length === 0
              ? <><AlertCircle size={18} aria-hidden="true" /> Nothing could be scheduled with your current availability and constraints.</>
              : generated.summary.unscheduledMinutes === 0
                ? <><CheckCircle2 size={18} aria-hidden="true" /> All {formatDuration(generated.summary.requestedMinutes)} of requested work fits this week.</>
                : <><Info size={18} aria-hidden="true" /> {formatDuration(generated.summary.scheduledMinutes)} of {formatDuration(generated.summary.requestedMinutes)} scheduled ({generated.summary.coveragePercent}%). The rest is listed below with reasons.</>}
          </div>

          <div className="result-actions">
            <button type="button" className="secondary-button" onClick={onEditPlan}><ArrowLeft size={16} aria-hidden="true" /> Edit plan</button>
            {stale && (
              <button type="button" className="primary-button" onClick={onGenerate}>
                <RefreshCw size={16} aria-hidden="true" /> Regenerate
              </button>
            )}
            <button type="button" className="primary-button" onClick={download} disabled={exporting || stale} aria-describedby="pdf-note">
              {exporting ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
              {exporting ? "Creating PDF…" : "Download PDF"}
            </button>
          </div>
          <div id="pdf-note" className="export-note-wrap" aria-live="polite">
            {exportNote && <p className={`export-note ${exportNote.kind}`} role={exportNote.kind === "error" ? "alert" : "status"}>{exportNote.text}</p>}
          </div>

          <div className="view-toggle" role="group" aria-label="Timetable view">
            <button type="button" aria-pressed={view === "calendar"} onClick={() => setView("calendar")}><CalendarDays size={15} aria-hidden="true" /> Calendar</button>
            <button type="button" aria-pressed={view === "agenda"} onClick={() => setView("agenda")}><List size={15} aria-hidden="true" /> Agenda</button>
          </div>

          {view === "calendar"
            ? <WeekCalendar input={generated.input} result={generated.result} />
            : <AgendaView input={generated.input} result={generated.result} />}

          <ScheduleSummary summary={generated.summary} />
          <UnscheduledTasks summary={generated.summary} />
          {generated.result.notes.length > 0 && (
            <ul className="engine-notes" aria-label="Scheduler notes">{generated.result.notes.map(n => <li key={n}>{n}</li>)}</ul>
          )}
        </>
      )}
    </section>
  );
}
