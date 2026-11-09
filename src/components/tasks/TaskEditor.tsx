import { Trash2 } from "lucide-react";
import { PRIORITY_LABEL, WEEKDAYS, WEEKDAY_NAMES } from "../../domain/constants";
import type { Goal, Priority, Task, ValidationIssue, Weekday } from "../../domain/types";
import { formatDuration } from "../../utils/timeUtils";
import { Field, describedBy } from "../common/Field";
import { InlineIssues } from "../common/IssueList";
import { NumberField } from "../common/NumberField";
import { TimeSelect } from "../common/TimeSelect";
import { TaskPreferenceFields } from "./TaskPreferenceFields";

interface Props {
  task: Task;
  index: number;
  goals: readonly Goal[];
  issues: readonly ValidationIssue[];
  onChange: (patch: Partial<Task>) => void;
  onRemove: () => void;
}

export function TaskEditor({ task, index, goals, issues, onChange, onRemove }: Props) {
  const id = `task-${task.id}`;
  const fieldError = (f: string) => issues.find(i => i.field === f && i.severity === "error")?.message;
  const loose = issues.filter(i => !i.field);
  const titleError = fieldError("title");

  return (
    <article className="task-card" aria-label={task.title.trim() || `Task ${index + 1}`}>
      <div className="task-card-top">
        <span className="task-index">Task {index + 1}</span>
        <button type="button" className="icon-button danger" onClick={onRemove} aria-label={`Remove task ${task.title.trim() || index + 1}`}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      <Field label="What do you need to do?" htmlFor={`${id}-title`} error={titleError}>
        <input
          id={`${id}-title`} className="text-input" value={task.title} placeholder="e.g. Practise system design questions"
          aria-invalid={!!titleError} aria-describedby={describedBy(`${id}-title`, undefined, titleError)}
          onChange={e => onChange({ title: e.target.value })}
        />
      </Field>

      <div className="grid-2">
        <Field label="Goal" htmlFor={`${id}-goal`} error={fieldError("goalId")}>
          <select id={`${id}-goal`} value={task.goalId} onChange={e => onChange({ goalId: e.target.value })}>
            {goals.map(g => <option key={g.id} value={g.id}>{g.title.trim() || "Untitled goal"}</option>)}
          </select>
        </Field>
        <Field label="Priority" htmlFor={`${id}-priority`}>
          <select id={`${id}-priority`} value={task.priority} onChange={e => onChange({ priority: e.target.value as Priority })}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
        </Field>
      </div>

      <NumberField
        id={`${id}-target`} label="Weekly target" suffix="minutes" step={15} min={15} value={task.weeklyTargetMinutes}
        hint={Number.isFinite(task.weeklyTargetMinutes) && task.weeklyTargetMinutes > 0 ? `That’s ${formatDuration(task.weeklyTargetMinutes)} this week. It’s a target, not a guarantee.` : "How much time you’d like to give this task this week."}
        error={fieldError("weeklyTargetMinutes")} onChange={n => onChange({ weeklyTargetMinutes: n })}
      />

      <fieldset className="constraint-group">
        <legend>Hard constraints <span>Always respected</span></legend>

        <label className="checkbox-line">
          <input
            type="checkbox" checked={!!task.deadline}
            onChange={e => onChange({ deadline: e.target.checked ? { day: 5, time: "17:00" } : undefined })}
          />
          <span>Has a firm deadline</span>
        </label>
        {task.deadline && (
          <div className="grid-2 indent">
            <Field label="Deadline day" htmlFor={`${id}-dl-day`} error={fieldError("deadline")}>
              <select
                id={`${id}-dl-day`} value={task.deadline.day}
                onChange={e => onChange({ deadline: { day: Number(e.target.value) as Weekday, time: task.deadline!.time } })}
              >
                {WEEKDAYS.map(d => <option key={d} value={d}>{WEEKDAY_NAMES[d]}</option>)}
              </select>
            </Field>
            <TimeSelect
              id={`${id}-dl-time`} label="Deadline time" value={task.deadline.time} allowEndOfDay
              onChange={time => onChange({ deadline: { day: task.deadline!.day, time } })}
            />
          </div>
        )}

        <label className="checkbox-line">
          <input type="checkbox" checked={task.splittable} onChange={e => onChange({ splittable: e.target.checked })} />
          <span>Can be split across several sessions</span>
        </label>
        {task.splittable ? (
          <div className="indent">
            <NumberField
              id={`${id}-min`} label="Minimum session" suffix="minutes" step={15} min={15} value={task.minSessionMinutes}
              hint="No session of this task will be shorter than this." error={fieldError("minSessionMinutes")}
              onChange={n => onChange({ minSessionMinutes: n })}
            />
          </div>
        ) : <p className="field-hint indent">This task needs one uninterrupted block equal to its weekly target.</p>}

        <label className="checkbox-line">
          <input
            type="checkbox" checked={task.maxMinutesPerDay !== undefined}
            onChange={e => onChange({ maxMinutesPerDay: e.target.checked ? 60 : undefined })}
          />
          <span>Limit time on this task per day</span>
        </label>
        {task.maxMinutesPerDay !== undefined && (
          <div className="indent">
            <NumberField
              id={`${id}-max`} label="Maximum per day" suffix="minutes" step={15} min={15} value={task.maxMinutesPerDay}
              error={fieldError("maxMinutesPerDay")} onChange={n => onChange({ maxMinutesPerDay: n })}
            />
          </div>
        )}
      </fieldset>

      <fieldset className="constraint-group soft">
        <legend>Soft preferences <span>Followed when possible</span></legend>
        <TaskPreferenceFields task={task} idPrefix={id} onChange={onChange} />
      </fieldset>

      <InlineIssues issues={loose} />
    </article>
  );
}
