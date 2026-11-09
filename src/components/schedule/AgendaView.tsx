import { COMMITMENT_SWATCH, WEEKDAYS, WEEKDAY_NAMES, goalSwatch } from "../../domain/constants";
import type { PlanningInput, ScheduleResult } from "../../domain/types";
import { expandCommitments } from "../../utils/commitments";
import { dateForWeekday, formatDate, formatDuration, formatRange, toMinutes } from "../../utils/timeUtils";

interface Props { input: PlanningInput; result: ScheduleResult }

/** Plain, linear alternative to the calendar: every day, in order, as a list. */
export function AgendaView({ input, result }: Props) {
  const tasks = new Map(input.tasks.map(t => [t.id, t]));
  const goals = new Map(input.goals.map(g => [g.id, g]));
  const fixed = expandCommitments(input.commitments, input.weekStart);

  return (
    <div className="agenda">
      {WEEKDAYS.map(day => {
        const items = [
          ...result.sessions.filter(s => s.day === day && tasks.has(s.taskId)).map(s => {
            const t = tasks.get(s.taskId)!;
            return { key: s.id, kind: "work" as const, start: toMinutes(s.startTime), time: formatRange(s.startTime, s.endTime), title: t.title.trim(), meta: goals.get(t.goalId)?.title.trim() ?? "", minutes: s.minutes, color: goalSwatch(input.goals, t.goalId) };
          }),
          ...fixed.filter(o => o.day === day).map(o => ({
            key: `${o.commitmentId}-${day}`, kind: "fixed" as const, start: o.startMinute, time: formatRange(o.startTime, o.endTime),
            title: o.title.trim() || "Commitment", meta: "Fixed commitment", minutes: o.endMinute - o.startMinute, color: COMMITMENT_SWATCH,
          })),
        ].sort((a, b) => a.start - b.start);
        return (
          <section key={day} className="agenda-day" aria-labelledby={`agenda-${day}`}>
            <h4 id={`agenda-${day}`}>{WEEKDAY_NAMES[day]} <span>{formatDate(dateForWeekday(input.weekStart, day), false)}</span></h4>
            {!items.length ? <p className="agenda-empty">Nothing scheduled.</p> : (
              <ul>
                {items.map(i => (
                  <li key={i.key} className={`agenda-item ${i.kind}`} style={{ borderLeftColor: i.color.border }}>
                    <span className="agenda-time">{i.time}</span>
                    <span className="agenda-main"><strong>{i.kind === "fixed" && <em>Fixed · </em>}{i.title}</strong>{i.meta && <small>{i.meta}</small>}</span>
                    <span className="agenda-duration">{formatDuration(i.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
