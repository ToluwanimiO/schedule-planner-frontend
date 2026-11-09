import type { ReactNode } from "react";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { PRIORITY_LABEL, STRATEGY_LABEL, TIME_OF_DAY_LABEL, WEEKDAYS, WEEKDAY_NAMES, WEEKDAY_SHORT } from "../../domain/constants";
import type { PlanningInput, SchedulerMode, ValidationIssue, WizardStepId } from "../../domain/types";
import { WIZARD_STEPS } from "../../domain/constants";
import { formatDays, formatDuration, formatRange, formatTime, formatWeekRange } from "../../utils/timeUtils";
import { IssueList } from "../common/IssueList";
import { describeCommitment } from "../../utils/commitments";

interface Props {
  input: PlanningInput;
  mode: SchedulerMode;
  issues: readonly ValidationIssue[];
  onEdit: (step: WizardStepId) => void;
}

function Section({ title, step, onEdit, children }: { title: string; step: WizardStepId; onEdit: (s: WizardStepId) => void; children: ReactNode }) {
  return (
    <section className="review-section">
      <div className="review-section-head">
        <h3>{title}</h3>
        <button type="button" className="text-button" onClick={() => onEdit(step)}>
          Edit <span className="sr-only">{WIZARD_STEPS.find(s => s.id === step)?.label}</span><ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
      {children}
    </section>
  );
}

export function ReviewStep({ input, mode, issues, onEdit }: Props) {
  const { goals, tasks, availability, commitments, strategy, weekStart } = input;
  const requested = tasks.reduce((s, t) => s + (Number.isFinite(t.weeklyTargetMinutes) ? t.weeklyTargetMinutes : 0), 0);
  const errors = issues.filter(i => i.severity === "error");

  return (
    <section className="step-content" aria-labelledby="review-heading">
      <p className="step-kicker"><ClipboardCheck size={16} aria-hidden="true" /> One last check</p>
      <h2 id="review-heading">Ready to plan your week?</h2>
      <p className="step-intro">Planning week: <strong>{formatWeekRange(weekStart)}</strong>. Check the details, or jump back to any step to change them.</p>

      {errors.length > 0 && (
        <IssueList
          title="Fix these before generating"
          issues={errors}
        />
      )}
      {errors.length > 0 && (
        <p className="step-links">{[...new Set(errors.map(e => e.step))].map(s => (
          <button key={s} type="button" className="text-button" onClick={() => onEdit(s)}>Go to {WIZARD_STEPS.find(x => x.id === s)?.label}</button>
        ))}</p>
      )}
      <IssueList issues={issues.filter(i => i.severity === "warning")} />

      <div className="review-summary">
        <div className="review-stats">
          <div><strong>{goals.length}</strong><span>Goals</span></div>
          <div><strong>{tasks.length}</strong><span>Tasks</span></div>
          <div><strong>{formatDuration(requested)}</strong><span>Requested</span></div>
          <div><strong>{commitments.length}</strong><span>Commitments</span></div>
        </div>

        <Section title="Goals and tasks" step="tasks" onEdit={onEdit}>
          {goals.map(g => {
            const mine = tasks.filter(t => t.goalId === g.id);
            return (
              <div key={g.id} className="review-goal">
                <h4>{g.title.trim() || "Untitled goal"}</h4>
                {!mine.length && <p className="review-empty">No tasks.</p>}
                {mine.map(t => (
                  <div key={t.id} className="review-task">
                    <span className="review-task-title">{t.title.trim() || "Untitled task"}</span>
                    <span className="review-task-meta">
                      {formatDuration(t.weeklyTargetMinutes)} · {PRIORITY_LABEL[t.priority]} priority
                      {t.deadline && ` · due ${WEEKDAY_SHORT[t.deadline.day]} ${formatTime(t.deadline.time)}`}
                      {!t.splittable && " · one block"}
                      {t.splittable && ` · min ${formatDuration(t.minSessionMinutes)}`}
                      {t.maxMinutesPerDay !== undefined && ` · max ${formatDuration(t.maxMinutesPerDay)}/day`}
                      {t.preferredDays.length > 0 && ` · prefers ${formatDays(t.preferredDays, "short")}`}
                      {t.preferredTimeOfDay && ` · ${TIME_OF_DAY_LABEL[t.preferredTimeOfDay].toLowerCase()}`}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </Section>

        <Section title="Weekly availability" step="availability" onEdit={onEdit}>
          <dl className="review-list">
            {WEEKDAYS.map(d => {
              const w = availability.filter(x => x.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
              return (
                <div key={d} className="review-line">
                  <dt>{WEEKDAY_NAMES[d]}</dt>
                  <dd>{w.length ? w.map(x => formatRange(x.startTime, x.endTime)).join(" and ") : "Not available"}</dd>
                </div>
              );
            })}
          </dl>
        </Section>

        <Section title="Fixed commitments" step="availability" onEdit={onEdit}>
          {commitments.length ? (
            <ul className="review-plain">{commitments.map(c => <li key={c.id}><strong>{c.title.trim() || "Untitled"}</strong> — {describeCommitment(c)}</li>)}</ul>
          ) : <p className="review-empty">No fixed commitments.</p>}
        </Section>

        <Section title="Strategy and constraints" step="preferences" onEdit={onEdit}>
          <dl className="review-list">
            <div className="review-line"><dt>Strategy</dt><dd>{STRATEGY_LABEL[strategy]}</dd></div>
            <div className="review-line"><dt>Engine</dt><dd>{mode === "greedy" ? "Greedy" : "Optimizer"}</dd></div>
            <div className="review-line"><dt>Hard constraints</dt><dd>Availability, commitments, deadlines, minimum sessions, daily maximums</dd></div>
            <div className="review-line"><dt>Soft preferences</dt><dd>Preferred days and times of day</dd></div>
          </dl>
        </Section>
      </div>
    </section>
  );
}
