import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { WEEKDAYS } from "../../domain/constants";
import { createCommitment } from "../../domain/defaults";
import type { AvailabilityWindow, FixedCommitment, ValidationIssue, Weekday } from "../../domain/types";
import { freeIntervalsByDay, totalLength } from "../../utils/intervals";
import { formatDuration, formatWeekRange } from "../../utils/timeUtils";
import { Field } from "../common/Field";
import { IssueList } from "../common/IssueList";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { CommitmentEditor } from "./CommitmentEditor";
import { CommitmentList } from "./CommitmentList";

interface Props {
  availability: readonly AvailabilityWindow[];
  commitments: readonly FixedCommitment[];
  weekStart: string;
  issues: readonly ValidationIssue[];
  onAddWindow: (day: Weekday) => void;
  onUpdateWindow: (id: string, patch: Partial<AvailabilityWindow>) => void;
  onRemoveWindow: (id: string) => void;
  onSaveCommitment: (c: FixedCommitment) => void;
  onRemoveCommitment: (id: string) => void;
  onSetWeekStart: (date: string) => void;
  onShiftWeek: (weeks: number) => void;
}

export function AvailabilityStep(p: Props) {
  const [editing, setEditing] = useState<{ draft: FixedCommitment; isNew: boolean } | null>(null);
  const windowIssues = p.issues.filter(i => i.entityId && p.availability.some(w => w.id === i.entityId));
  const commitmentIssues = p.issues.filter(i => i.entityId && p.commitments.some(c => c.id === i.entityId));
  const generalIssues = p.issues.filter(i => !i.entityId);

  const freeMinutes = useMemo(() => {
    const free = freeIntervalsByDay(p.availability, p.commitments, p.weekStart);
    return WEEKDAYS.reduce((s, d) => s + totalLength(free[d]), 0);
  }, [p.availability, p.commitments, p.weekStart]);

  return (
    <section className="step-content" aria-labelledby="avail-heading">
      <p className="step-kicker"><CalendarDays size={16} aria-hidden="true" /> Make space for the work</p>
      <h2 id="avail-heading">When are you available?</h2>
      <p className="step-intro">Set when you could work, then add the commitments that already occupy your week. Availability says when you <em>could</em> work; commitments say when you <em>can’t</em>.</p>

      <div className="week-picker">
        <button type="button" className="icon-button" aria-label="Previous week" onClick={() => p.onShiftWeek(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <div>
          <strong>Planning week: {formatWeekRange(p.weekStart)}</strong>
          <span>Monday–Sunday. One-off commitments only apply inside this week.</span>
        </div>
        <button type="button" className="icon-button" aria-label="Next week" onClick={() => p.onShiftWeek(1)}><ChevronRight size={18} aria-hidden="true" /></button>
        <Field label="Jump to date" htmlFor="week-jump" hideLabel>
          <input id="week-jump" type="date" className="text-input" value={p.weekStart} onChange={e => e.target.value && p.onSetWeekStart(e.target.value)} />
        </Field>
      </div>

      <div className="field-section">
        <div className="section-heading">
          <div><h3>Weekly availability</h3><p>Add as many windows per day as you need.</p></div>
          <span className="count-pill" aria-live="polite">{formatDuration(freeMinutes)} free after commitments</span>
        </div>
        <AvailabilityEditor windows={p.availability} issues={windowIssues} onAdd={p.onAddWindow} onUpdate={p.onUpdateWindow} onRemove={p.onRemoveWindow} />
      </div>

      <div className="field-section">
        <div className="section-heading">
          <div><h3>Fixed commitments</h3><p>Work, classes, services, appointments — anything the timetable must avoid.</p></div>
          {!editing && <button type="button" className="secondary-button" onClick={() => setEditing({ draft: createCommitment(), isNew: true })}><Plus size={16} aria-hidden="true" /> Add commitment</button>}
        </div>
        {editing && (
          <CommitmentEditor
            key={editing.draft.id} initial={editing.draft} isNew={editing.isNew} weekStart={p.weekStart}
            onSave={c => { p.onSaveCommitment(c); setEditing(null); }} onCancel={() => setEditing(null)}
          />
        )}
        <CommitmentList commitments={p.commitments} issues={commitmentIssues} onEdit={c => setEditing({ draft: c, isNew: false })} onRemove={p.onRemoveCommitment} />
      </div>

      <IssueList issues={generalIssues} />
    </section>
  );
}
