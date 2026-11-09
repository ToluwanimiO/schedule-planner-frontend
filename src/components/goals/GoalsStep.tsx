import { useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import type { Goal, Task, ValidationIssue } from "../../domain/types";
import { IssueList } from "../common/IssueList";

interface Props {
  goals: readonly Goal[];
  tasks: readonly Task[];
  issues: readonly ValidationIssue[];
  onAdd: () => string;
  onUpdate: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}

const PLACEHOLDERS = ["e.g. Improve my Python and Django skills", "e.g. Make progress on a side project", "e.g. Spend time reading and reflecting"];

export function GoalsStep({ goals, tasks, issues, onAdd, onUpdate, onRemove }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const countFor = (id: string) => tasks.filter(t => t.goalId === id).length;
  const issueFor = (id: string) => issues.find(i => i.entityId === id && i.severity === "error");

  const requestRemove = (g: Goal) => {
    if (countFor(g.id) === 0) onRemove(g.id);
    else setConfirmId(g.id);
  };

  return (
    <section className="step-content" aria-labelledby="goals-heading">
      <p className="step-kicker"><Target size={16} aria-hidden="true" /> Start with why</p>
      <h2 id="goals-heading">What do you want to make progress on this week?</h2>
      <p className="step-intro">Write each goal in your own words. You’ll break goals into specific tasks in the next step.</p>

      <ul className="goal-list">
        {goals.map((g, i) => {
          const problem = issueFor(g.id);
          const n = countFor(g.id);
          return (
            <li key={g.id} className={`goal-card${problem ? " has-error" : ""}`}>
              <div className="goal-row">
                <span className="goal-number" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <input
                  className="goal-input" aria-label={`Goal ${i + 1}`} value={g.title} autoFocus={focusId === g.id}
                  placeholder={PLACEHOLDERS[i % PLACEHOLDERS.length]} aria-invalid={!!problem}
                  onChange={e => onUpdate(g.id, e.target.value)}
                />
                {n > 0 && <span className="count-pill">{n} {n === 1 ? "task" : "tasks"}</span>}
                <button type="button" className="icon-button danger" aria-label={`Remove goal ${i + 1}${g.title ? `: ${g.title}` : ""}`} onClick={() => requestRemove(g)}>
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </div>
              {problem && <p className="field-error" role="alert">{problem.message}</p>}
              {confirmId === g.id && (
                <div className="confirm-row" role="alertdialog" aria-label="Confirm removing goal">
                  <p>Removing this goal also removes its {n} {n === 1 ? "task" : "tasks"}. This can’t be undone.</p>
                  <button type="button" className="danger-button" onClick={() => { onRemove(g.id); setConfirmId(null); }}>Remove goal and tasks</button>
                  <button type="button" className="secondary-button" onClick={() => setConfirmId(null)}>Keep</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" className="add-row-button" onClick={() => setFocusId(onAdd())}><Plus size={17} aria-hidden="true" /> Add another goal</button>

      <IssueList issues={issues.filter(i => !i.entityId)} />
      <IssueList issues={issues.filter(i => i.entityId && i.severity === "warning")} />
    </section>
  );
}
