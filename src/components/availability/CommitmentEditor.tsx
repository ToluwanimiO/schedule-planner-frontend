import { useId, useState } from "react";
import { WEEKDAY_NAMES } from "../../domain/constants";
import type { FixedCommitment } from "../../domain/types";
import { validateCommitment } from "../../utils/scheduleValidation";
import { addDays, weekdayOfDate } from "../../utils/timeUtils";
import { Field, describedBy } from "../common/Field";
import { TimeSelect } from "../common/TimeSelect";
import { WeekdayPicker } from "../common/WeekdayPicker";

interface Props {
  initial: FixedCommitment;
  isNew: boolean;
  weekStart: string;
  onSave: (c: FixedCommitment) => void;
  onCancel: () => void;
}

/** Form for creating or editing one commitment. Works on a draft; nothing is saved until “Save”. */
export function CommitmentEditor({ initial, isNew, weekStart, onSave, onCancel }: Props) {
  const uid = useId();
  const [draft, setDraft] = useState<FixedCommitment>(initial);
  const [tried, setTried] = useState(false);
  const patch = (p: Partial<FixedCommitment>) => setDraft(d => ({ ...d, ...p }));
  const problems = validateCommitment(draft);
  const show = tried ? problems : [];
  const err = (needle: RegExp) => show.find(p => needle.test(p));
  const date = draft.date ?? "";
  const dateDay = weekdayOfDate(date);

  const save = () => {
    setTried(true);
    if (problems.length) return;
    onSave({ ...draft, title: draft.title.trim() });
  };

  return (
    <div className="commitment-editor" role="group" aria-label={isNew ? "New commitment" : `Edit ${initial.title || "commitment"}`}>
      <h4>{isNew ? "New commitment" : "Edit commitment"}</h4>
      <Field label="Title" htmlFor={`${uid}-title`} error={err(/title/i)}>
        <input
          id={`${uid}-title`} className="text-input" value={draft.title} placeholder="e.g. Choir rehearsal"
          aria-invalid={!!err(/title/i)} aria-describedby={describedBy(`${uid}-title`, undefined, err(/title/i))}
          onChange={e => patch({ title: e.target.value })}
        />
      </Field>

      <fieldset className="segmented">
        <legend>Repeats</legend>
        <label className={draft.recurrence === "weekly" ? "selected" : ""}>
          <input type="radio" name={`${uid}-rec`} checked={draft.recurrence === "weekly"} onChange={() => patch({ recurrence: "weekly" })} /> Every week
        </label>
        <label className={draft.recurrence === "once" ? "selected" : ""}>
          <input type="radio" name={`${uid}-rec`} checked={draft.recurrence === "once"} onChange={() => patch({ recurrence: "once" })} /> One-off
        </label>
      </fieldset>

      {draft.recurrence === "weekly" ? (
        <WeekdayPicker legend="On these days" presets value={draft.days} onChange={days => patch({ days })} error={err(/weekday/i)} />
      ) : (
        <Field
          label="Date" htmlFor={`${uid}-date`} error={err(/date/i)}
          hint={dateDay ? `${WEEKDAY_NAMES[dateDay]}${date >= weekStart && date <= addDays(weekStart, 6) ? "" : " — outside the planning week, so it won’t affect this timetable"}` : undefined}
        >
          <input
            id={`${uid}-date`} type="date" className="text-input" value={date}
            aria-invalid={!!err(/date/i)} aria-describedby={describedBy(`${uid}-date`, dateDay ? "hint" : undefined, err(/date/i))}
            onChange={e => patch({ date: e.target.value || undefined })}
          />
        </Field>
      )}

      <div className="grid-2">
        <TimeSelect id={`${uid}-start`} label="Starts" value={draft.startTime} onChange={startTime => patch({ startTime })} />
        <TimeSelect id={`${uid}-end`} label="Ends" allowEndOfDay value={draft.endTime} onChange={endTime => patch({ endTime })} error={err(/end time|start and end/i)} />
      </div>

      <div className="editor-actions">
        <button type="button" className="primary-button" onClick={save}>{isNew ? "Add commitment" : "Save changes"}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
