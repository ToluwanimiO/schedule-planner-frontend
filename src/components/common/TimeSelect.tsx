import { MINUTE_STEP } from "../../domain/constants";
import { formatTime, fromMinutes, toMinutes } from "../../utils/timeUtils";
import { Field, describedBy } from "./Field";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Offer 12:00 AM (end of day) as the last option — for end times. */
  allowEndOfDay?: boolean;
  hideLabel?: boolean;
  error?: string;
}

const OPTIONS = Array.from({ length: (24 * 60) / MINUTE_STEP }, (_, i) => fromMinutes(i * MINUTE_STEP));

/** Time picker with consistent 12-hour labels in 15-minute steps (native time inputs vary by browser/locale). */
export function TimeSelect({ id, label, value, onChange, allowEndOfDay, hideLabel, error }: Props) {
  const options = allowEndOfDay ? [...OPTIONS, "24:00"] : OPTIONS;
  // Keep any off-grid value visible instead of silently rewriting it.
  const withCurrent = value && !options.includes(value) && !Number.isNaN(toMinutes(value)) ? [...options, value].sort() : options;
  return (
    <Field label={label} htmlFor={id} error={error} hideLabel={hideLabel}>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={describedBy(id, undefined, error)}>
        {withCurrent.map(t => <option key={t} value={t}>{t === "24:00" ? "12:00 AM (end of day)" : formatTime(t)}</option>)}
      </select>
    </Field>
  );
}
