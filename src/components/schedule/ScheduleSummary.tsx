import { CheckCircle2, CircleDashed, CircleDot } from "lucide-react";
import type { ScheduleSummary as Summary, TaskBreakdown } from "../../domain/types";
import { formatDuration } from "../../utils/timeUtils";

const STATUS_LABEL: Record<TaskBreakdown["status"], string> = { full: "Fully scheduled", partial: "Partly scheduled", none: "Not scheduled" };
const DEADLINE_LABEL: Record<TaskBreakdown["deadlineOutcome"], string> = { met: "Deadline met", missed: "Deadline missed", none: "—" };

export function StatusBadge({ status }: { status: TaskBreakdown["status"] }) {
  const Icon = status === "full" ? CheckCircle2 : status === "partial" ? CircleDot : CircleDashed;
  return <span className={`status-badge ${status}`}><Icon size={14} aria-hidden="true" />{STATUS_LABEL[status]}</span>;
}

/** Presents statistics computed by buildSummary(); does no calculation of its own. */
export function ScheduleSummary({ summary }: { summary: Summary }) {
  const withDeadlines = summary.deadlinesMet + summary.deadlinesMissed;
  return (
    <section className="summary" aria-labelledby="summary-heading">
      <h3 id="summary-heading">Summary</h3>
      <dl className="stat-grid">
        <div><dt>Requested</dt><dd>{formatDuration(summary.requestedMinutes)}</dd></div>
        <div><dt>Scheduled</dt><dd>{formatDuration(summary.scheduledMinutes)}</dd></div>
        <div><dt>Unscheduled</dt><dd>{formatDuration(summary.unscheduledMinutes)}</dd></div>
        <div><dt>Work coverage</dt><dd>{summary.coveragePercent}%</dd></div>
      </dl>
      <div className="coverage-track" role="progressbar" aria-label="Work coverage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.coveragePercent}>
        <div style={{ width: `${summary.coveragePercent}%` }} />
      </div>
      <p className="summary-line">
        <strong>{summary.tasksFull}</strong> of {summary.tasks.length} {summary.tasks.length === 1 ? "task" : "tasks"} fully scheduled
        {summary.tasksPartialOrNone > 0 && <>, <strong>{summary.tasksPartialOrNone}</strong> partly or not scheduled</>}.
        {withDeadlines > 0 && <> Deadlines: <strong>{summary.deadlinesMet}</strong> met, <strong>{summary.deadlinesMissed}</strong> missed.</>}
      </p>

      <div className="table-scroll" role="region" aria-label="Requested versus scheduled time per task" tabIndex={0}>
        <table className="breakdown">
          <caption className="sr-only">Requested versus scheduled time for each task</caption>
          <thead>
            <tr><th scope="col">Task</th><th scope="col">Requested</th><th scope="col">Scheduled</th><th scope="col">Remaining</th><th scope="col">Status</th><th scope="col">Deadline</th></tr>
          </thead>
          <tbody>
            {summary.tasks.map(t => (
              <tr key={t.taskId}>
                <th scope="row"><span className="task-name">{t.title || "Untitled task"}</span><small>{t.goalTitle}</small></th>
                <td>{formatDuration(t.requestedMinutes)}</td>
                <td>{formatDuration(t.scheduledMinutes)}</td>
                <td>{formatDuration(t.remainingMinutes)}</td>
                <td><StatusBadge status={t.status} /></td>
                <td>{DEADLINE_LABEL[t.deadlineOutcome]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
