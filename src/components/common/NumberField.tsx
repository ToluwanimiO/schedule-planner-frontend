import { Field, describedBy } from "./Field";

interface Props {
  id: string;
  label: string;
  /** NaN means "empty / not a number" and is passed through to validation untouched. */
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  hint?: string;
  error?: string;
}

/** Numeric input that never rewrites what the user typed; invalid values are reported, not clamped. */
export function NumberField({ id, label, value, onChange, suffix, step = 1, min, hint, error }: Props) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <div className="input-with-suffix">
        <input
          id={id} type="number" inputMode="numeric" step={step} min={min}
          value={Number.isFinite(value) ? String(value) : ""}
          onChange={e => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)}
        />
        {suffix && <span aria-hidden="true">{suffix}</span>}
      </div>
    </Field>
  );
}
