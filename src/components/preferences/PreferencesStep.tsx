import { Info, Lock, SlidersHorizontal, Wand2 } from "lucide-react";
import { PRIORITY_LABEL, STRATEGIES, WEEKDAY_NAMES } from "../../domain/constants";
import type { Goal, SchedulerMode, SchedulingStrategy, Task } from "../../domain/types";
import { schedulerAdapter } from "../../scheduler/schedulerAdapter";
import { formatDuration, formatTime } from "../../utils/timeUtils";
import { TaskPreferenceFields } from "../tasks/TaskPreferenceFields";

interface Props {
  goals: readonly Goal[];
  tasks: readonly Task[];
  strategy: SchedulingStrategy;
  mode: SchedulerMode;
  onStrategy: (s: SchedulingStrategy) => void;
  onMode: (m: SchedulerMode) => void;
  onTaskChange: (id: string, patch: Partial<Task>) => void;
  onEditTasks: () => void;
}

export function PreferencesStep({ goals, tasks, strategy, mode, onStrategy, onMode, onTaskChange, onEditTasks }: Props) {
  const modes = schedulerAdapter.describeModes();
  const goalTitle = (id: string) => goals.find(g => g.id === id)?.title.trim() || "Unknown goal";

  return (
    <section className="step-content" aria-labelledby="prefs-heading">
      <p className="step-kicker"><SlidersHorizontal size={16} aria-hidden="true" /> Personalise your plan</p>
      <h2 id="prefs-heading">How should trade-offs be made?</h2>
      <p className="step-intro">When your tasks compete for the same time, this decides who goes first.</p>

      <fieldset className="field-section radio-group">
        <legend>Scheduling strategy</legend>
        {STRATEGIES.map(s => (
          <label key={s.id} className={`choice-card${strategy === s.id ? " selected" : ""}`}>
            <input type="radio" name="strategy" value={s.id} checked={strategy === s.id} onChange={() => onStrategy(s.id)} />
            <span className="choice-radio" aria-hidden="true"><span /></span>
            <span className="choice-copy"><strong>{s.label}</strong><small>{s.description}</small></span>
          </label>
        ))}
      </fieldset>

      <div className="constraint-explainer">
        <div><Lock size={16} aria-hidden="true" /><div><strong>Hard constraints</strong><p>Availability, fixed commitments, firm deadlines, minimum sessions, daily maximums and “can’t be split”. A valid timetable never breaks these — work that can’t fit without breaking them is left unscheduled.</p></div></div>
        <div><Info size={16} aria-hidden="true" /><div><strong>Soft preferences</strong><p>Preferred days and times of day, and the strategy above. They shape the timetable but never stop a task from being scheduled.</p></div></div>
      </div>

      <div className="field-section">
        <div className="section-heading">
          <div><h3>Per-task constraints and preferences</h3><p>Hard constraints are edited on the Tasks step. Soft preferences can be changed here.</p></div>
          <button type="button" className="secondary-button" onClick={onEditTasks}>Edit tasks</button>
        </div>
        {!tasks.length && <p className="empty-note">No tasks yet.</p>}
        {tasks.map(t => (
          <details key={t.id} className="task-pref" open={tasks.length <= 3}>
            <summary>
              <span className="task-pref-title">{t.title.trim() || "Untitled task"}</span>
              <span className="task-pref-meta">{goalTitle(t.goalId)} · {PRIORITY_LABEL[t.priority]} · {formatDuration(t.weeklyTargetMinutes)}</span>
            </summary>
            <div className="pref-body">
              <ul className="chip-list" aria-label="Hard constraints">
                <li className="chip hard"><Lock size={12} aria-hidden="true" />{t.deadline ? `Due ${WEEKDAY_NAMES[t.deadline.day]} ${formatTime(t.deadline.time)}` : "No deadline"}</li>
                <li className="chip hard">{t.splittable ? `Split OK · min ${formatDuration(t.minSessionMinutes)}` : "One block only"}</li>
                <li className="chip hard">{t.maxMinutesPerDay !== undefined ? `Max ${formatDuration(t.maxMinutesPerDay)}/day` : "No daily max"}</li>
              </ul>
              <TaskPreferenceFields task={t} idPrefix={`pref-${t.id}`} onChange={p => onTaskChange(t.id, p)} />
            </div>
          </details>
        ))}
      </div>

      <fieldset className="field-section radio-group">
        <legend><Wand2 size={15} aria-hidden="true" /> Scheduling engine</legend>
        {modes.map(m => (
          <label key={m.mode} className={`choice-card${mode === m.mode ? " selected" : ""}${m.available ? "" : " unavailable"}`}>
            <input type="radio" name="mode" value={m.mode} disabled={!m.available} checked={mode === m.mode} onChange={() => onMode(m.mode)} />
            <span className="choice-radio" aria-hidden="true"><span /></span>
            <span className="choice-copy"><strong>{m.label}</strong><small>{m.available ? m.detail : "Not connected yet — see the README to plug in your algorithm."}</small></span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
