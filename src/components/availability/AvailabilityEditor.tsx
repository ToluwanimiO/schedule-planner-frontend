import { Plus, Trash2 } from "lucide-react";
import { WEEKDAYS, WEEKDAY_NAMES } from "../../domain/constants";
import type { AvailabilityWindow, ValidationIssue, Weekday } from "../../domain/types";
import { TimeSelect } from "../common/TimeSelect";

interface Props {
  windows: readonly AvailabilityWindow[];
  issues: readonly ValidationIssue[];
  onAdd: (day: Weekday) => void;
  onUpdate: (id: string, patch: Partial<AvailabilityWindow>) => void;
  onRemove: (id: string) => void;
}

/** One row per weekday; each day can hold any number of non-overlapping windows. */
export function AvailabilityEditor({ windows, issues, onAdd, onUpdate, onRemove }: Props) {
  return (
    <div className="availability-list">
      {WEEKDAYS.map(day => {
        const mine = windows.filter(w => w.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
        return (
          <div key={day} className={`availability-row${mine.length ? "" : " off"}`} role="group" aria-label={WEEKDAY_NAMES[day]}>
            <div className="availability-day">{WEEKDAY_NAMES[day]}</div>
            <div className="availability-windows">
              {!mine.length && <span className="unavailable-label">Not available</span>}
              {mine.map((w, i) => {
                const problems = issues.filter(x => x.entityId === w.id);
                const base = `${WEEKDAY_NAMES[day]} window ${i + 1}`;
                return (
                  <div key={w.id} className="window-item">
                    <div className="time-range">
                      <TimeSelect id={`${w.id}-s`} label={`${base} start`} hideLabel value={w.startTime} onChange={v => onUpdate(w.id, { startTime: v })} />
                      <span aria-hidden="true">to</span>
                      <TimeSelect id={`${w.id}-e`} label={`${base} end`} hideLabel allowEndOfDay value={w.endTime} onChange={v => onUpdate(w.id, { endTime: v })} />
                      <button type="button" className="icon-button danger" aria-label={`Remove ${base}`} onClick={() => onRemove(w.id)}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                    {problems.map(p => <p key={p.id} className="field-error" role="alert">{p.message}</p>)}
                  </div>
                );
              })}
            </div>
            <button type="button" className="text-button" onClick={() => onAdd(day)}>
              <Plus size={15} aria-hidden="true" /> Add<span className="sr-only"> window on {WEEKDAY_NAMES[day]}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
