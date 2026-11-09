import { AlertTriangle } from "lucide-react";
import type { ScheduleSummary } from "../../domain/types";
import { formatDuration } from "../../utils/timeUtils";

/** Work that didn't fit. Reasons are exactly what the scheduler reported — nothing is invented here. */
export function UnscheduledTasks({ summary }: { summary: ScheduleSummary }) {
  const left = summary.tasks.filter(t => t.remainingMinutes > 0);
  if (!left.length) return null;
  return (
    <section className="unscheduled" aria-labelledby="unscheduled-heading">
      <h3 id="unscheduled-heading"><AlertTriangle size={18} aria-hidden="true" /> Work that didn’t fit</h3>
      <p className="muted">{left.length} {left.length === 1 ? "task has" : "tasks have"} time left over — {formatDuration(summary.unscheduledMinutes)} in total.</p>
      <ul>
        {left.map(t => (
          <li key={t.taskId}>
            <div className="unscheduled-head">
              <strong>{t.title || "Untitled task"}</strong>
              <span>{formatDuration(t.remainingMinutes)} left of {formatDuration(t.requestedMinutes)}</span>
            </div>
            {t.reasons.length ? <ul className="reasons">{t.reasons.map(r => <li key={r}>{r}</li>)}</ul> : <p className="muted">The scheduler didn’t report a reason for this task.</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
