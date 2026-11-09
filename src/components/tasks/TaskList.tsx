import { Plus } from "lucide-react";
import type { Goal, Task, ValidationIssue } from "../../domain/types";
import { formatDuration } from "../../utils/timeUtils";
import { InlineIssues } from "../common/IssueList";
import { TaskEditor } from "./TaskEditor";

interface Props {
  goal: Goal;
  index: number;
  tasks: readonly Task[];
  allGoals: readonly Goal[];
  issues: readonly ValidationIssue[];
  onAdd: () => void;
  onChange: (taskId: string, patch: Partial<Task>) => void;
  onRemove: (taskId: string) => void;
}

export function TaskList({ goal, index, tasks, allGoals, issues, onAdd, onChange, onRemove }: Props) {
  const total = tasks.reduce((s, t) => s + (Number.isFinite(t.weeklyTargetMinutes) ? t.weeklyTargetMinutes : 0), 0);
  return (
    <section className="goal-task-group" aria-labelledby={`goal-${goal.id}`}>
      <div className="goal-group-heading">
        <span className="goal-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <h3 id={`goal-${goal.id}`}>{goal.title.trim() || "Untitled goal"}</h3>
          <p>{tasks.length} {tasks.length === 1 ? "task" : "tasks"}{tasks.length > 0 && ` · ${formatDuration(total)} per week`}</p>
        </div>
        <button type="button" className="text-button" onClick={onAdd}><Plus size={16} aria-hidden="true" /> Add task</button>
      </div>
      <InlineIssues issues={issues.filter(i => i.entityId === goal.id)} />
      {tasks.map((t, i) => (
        <TaskEditor
          key={t.id} task={t} index={i} goals={allGoals} issues={issues.filter(x => x.entityId === t.id)}
          onChange={patch => onChange(t.id, patch)} onRemove={() => onRemove(t.id)}
        />
      ))}
      {!tasks.length && <button type="button" className="add-row-button" onClick={onAdd}><Plus size={17} aria-hidden="true" /> Add the first task for this goal</button>}
    </section>
  );
}
