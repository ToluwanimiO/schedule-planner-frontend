import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  /** Visually hide the label but keep it for screen readers. */
  hideLabel?: boolean;
  children: ReactNode;
}

/** Label + control + hint + inline error. The control must use `id={htmlFor}`. */
export function Field({ label, htmlFor, hint, error, optional, hideLabel, children }: FieldProps) {
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={htmlFor} className={hideLabel ? "sr-only" : undefined}>{label}{optional && <span className="field-optional"> (optional)</span>}</label>
      {hint && <p className="field-hint" id={`${htmlFor}-hint`}>{hint}</p>}
      {children}
      {error && <p className="field-error" id={`${htmlFor}-error`} role="alert">{error}</p>}
    </div>
  );
}

export const describedBy = (id: string, hint?: string, error?: string) =>
  [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
