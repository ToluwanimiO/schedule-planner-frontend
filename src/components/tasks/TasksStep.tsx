import { ListTodo } from "lucide-react";
import type { Goal, Task, ValidationIssue } from "../../domain/types";
import { formatDuration } from "../../utils/timeUtils";
import { IssueList } from "../common/IssueList";
import { TaskList } from "./TaskList";

interface Props {
  goals: readonly Goal[];
  tasks: readonly Task[];
  issues: readonly ValidationIssue[];
  onAdd: (goalId: string) => void;
  onChange: (taskId: string, patch: Partial<Task>) => void;
  onRemove: (taskId: string) => void;
}

export function TasksStep({ goals, tasks, issues, onAdd, onChange, onRemove }: Props) {
  const total = tasks.reduce((s, t) => s + (Number.isFinite(t.weeklyTargetMinutes) ? t.weeklyTargetMinutes : 0), 0);
  return (
    <section className="step-content" aria-labelledby="tasks-heading">
      <p className="step-kicker"><ListTodo size={16} aria-hidden="true" /> Turn goals into work</p>
      <h2 id="tasks-heading">What work needs to happen?</h2>
      <p className="step-intro">
        Add tasks under each goal with a weekly target. Targets are what you’d like to do — if your week can’t fit them all,
        the timetable will show what’s left rather than forcing it in.
      </p>
      <p className="summary-strip" aria-live="polite">
        <span>{goals.length} {goals.length === 1 ? "goal" : "goals"}</span>
        <span>{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
        <span>{formatDuration(total)} requested</span>
      </p>
      <IssueList issues={issues.filter(i => !i.entityId)} />
      <div className="goal-task-groups">
        {goals.map((g, i) => (
          <TaskList
            key={g.id} goal={g} index={i} allGoals={goals} tasks={tasks.filter(t => t.goalId === g.id)}
            issues={issues} onAdd={() => onAdd(g.id)} onChange={onChange} onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
}
