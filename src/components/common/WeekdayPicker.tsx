import { useId } from "react";
import { WEEKDAYS, WEEKDAY_NAMES, WEEKDAY_SHORT, WEEKEND, WORK_WEEK } from "../../domain/constants";
import type { Weekday } from "../../domain/types";
import { formatDays, sameDaySet, sortDays } from "../../utils/timeUtils";

interface Props {
  legend: string;
  value: readonly Weekday[];
  onChange: (days: Weekday[]) => void;
  /** Show Every day / Weekdays / Weekends / Clear shortcuts. */
  presets?: boolean;
  error?: string;
  emptyText?: string;
}

const PRESETS: { label: string; days: readonly Weekday[] }[] = [
  { label: "Every day", days: WEEKDAYS },
  { label: "Weekdays", days: WORK_WEEK },
  { label: "Weekends", days: WEEKEND },
];

/**
 * Independent multi-select for weekdays. Presets simply replace the selection;
 * every day button stays toggleable afterwards.
 */
export function WeekdayPicker({ legend, value, onChange, presets, error, emptyText }: Props) {
  const id = useId();
  const toggle = (d: Weekday) => onChange(sortDays(value.includes(d) ? value.filter(x => x !== d) : [...value, d]));
  return (
    <fieldset className={`weekday-picker${error ? " has-error" : ""}`} aria-describedby={error ? `${id}-error` : `${id}-summary`}>
      <legend>{legend}</legend>
      {presets && (
        <div className="preset-row">
          {PRESETS.map(p => (
            <button key={p.label} type="button" className="chip-button" aria-pressed={sameDaySet(value, p.days)} onClick={() => onChange([...p.days])}>
              {p.label}
            </button>
          ))}
          <button type="button" className="chip-button subtle" disabled={!value.length} onClick={() => onChange([])}>Clear</button>
        </div>
      )}
      <div className="day-buttons">
        {WEEKDAYS.map(d => (
          <button
            key={d} type="button" className={`day-button${value.includes(d) ? " selected" : ""}`}
            aria-pressed={value.includes(d)} aria-label={WEEKDAY_NAMES[d]} title={WEEKDAY_NAMES[d]} onClick={() => toggle(d)}
          >
            {WEEKDAY_SHORT[d]}
          </button>
        ))}
      </div>
      <p className="picker-summary" id={`${id}-summary`} aria-live="polite">
        {value.length ? `Selected: ${formatDays(value)}` : emptyText ?? "No days selected"}
      </p>
      {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
    </fieldset>
  );
}
