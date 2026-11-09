import { TIME_OF_DAY_LABEL } from "../../domain/constants";
import type { Task, TimeOfDay } from "../../domain/types";
import { Field } from "../common/Field";
import { WeekdayPicker } from "../common/WeekdayPicker";

interface Props { task: Task; idPrefix: string; onChange: (patch: Partial<Task>) => void }

/** Soft preferences only. Shared by the task editor and the preferences step. */
export function TaskPreferenceFields({ task, idPrefix, onChange }: Props) {
  return (
    <div className="pref-fields">
      <WeekdayPicker
        legend="Preferred days" value={task.preferredDays} emptyText="No preference — any day works"
        onChange={days => onChange({ preferredDays: days })}
      />
      <Field label="Preferred time of day" htmlFor={`${idPrefix}-tod`}>
        <select
          id={`${idPrefix}-tod`} value={task.preferredTimeOfDay ?? ""}
          onChange={e => onChange({ preferredTimeOfDay: (e.target.value || undefined) as TimeOfDay | undefined })}
        >
          <option value="">No preference</option>
          {(Object.keys(TIME_OF_DAY_LABEL) as TimeOfDay[]).map(t => <option key={t} value={t}>{TIME_OF_DAY_LABEL[t]}</option>)}
        </select>
      </Field>
    </div>
  );
}
