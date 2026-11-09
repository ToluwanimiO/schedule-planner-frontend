import { useMemo } from "react";
import { COMMITMENT_SWATCH, DEFAULT_CALENDAR_END, DEFAULT_CALENDAR_START, WEEKDAYS, WEEKDAY_NAMES, WEEKDAY_SHORT, goalSwatch } from "../../domain/constants";
import type { PlanningInput, ScheduleResult } from "../../domain/types";
import { calendarBounds, layoutDay } from "../../utils/calendarLayout";
import { expandCommitments } from "../../utils/commitments";
import { dateForWeekday, formatDate, formatRange, formatTime, toMinutes } from "../../utils/timeUtils";

interface Props { input: PlanningInput; result: ScheduleResult }

interface CalEvent {
  id: string; kind: "work" | "fixed"; title: string; subtitle: string;
  start: number; end: number; startTime: string; endTime: string; day: number; color: { bg: string; border: string; text: string };
}

const HOUR_PX = 52;
const MIN_EVENT_PX = 22;

/** Monday–Sunday timetable: time down the side, days across. Overlaps are placed side by side. */
export function WeekCalendar({ input, result }: Props) {
  const { events, rangeStart, rangeEnd } = useMemo(() => {
    const taskById = new Map(input.tasks.map(t => [t.id, t]));
    const goalById = new Map(input.goals.map(g => [g.id, g]));
    const events: CalEvent[] = [];
    for (const s of result.sessions) {
      const t = taskById.get(s.taskId);
      if (!t) continue;
      events.push({
        id: s.id, kind: "work", title: t.title.trim(), subtitle: goalById.get(t.goalId)?.title.trim() ?? "",
        start: toMinutes(s.startTime), end: toMinutes(s.endTime), startTime: s.startTime, endTime: s.endTime, day: s.day,
        color: goalSwatch(input.goals, t.goalId),
      });
    }
    for (const o of expandCommitments(input.commitments, input.weekStart)) {
      events.push({
        id: `${o.commitmentId}-${o.day}`, kind: "fixed", title: o.title.trim() || "Commitment", subtitle: "Fixed commitment",
        start: o.startMinute, end: o.endMinute, startTime: o.startTime, endTime: o.endTime, day: o.day, color: COMMITMENT_SWATCH,
      });
    }
    return { events, ...calendarBounds(events, DEFAULT_CALENDAR_START, DEFAULT_CALENDAR_END) };
  }, [input, result]);

  const hours = (rangeEnd - rangeStart) / 60;
  const height = hours * HOUR_PX;
  const hourMarks = Array.from({ length: hours + 1 }, (_, i) => rangeStart + i * 60);

  return (
    <div className="cal-scroll" role="region" aria-label="Weekly timetable. Scroll sideways on small screens, or use the agenda view." tabIndex={0}>
      <div className="cal">
        <div className="cal-head">
          <div className="cal-corner" />
          {WEEKDAYS.map(d => (
            <div key={d} className="cal-day-head">
              <strong>{WEEKDAY_SHORT[d]}</strong>
              <span>{formatDate(dateForWeekday(input.weekStart, d), false)}</span>
            </div>
          ))}
        </div>
        <div className="cal-body" style={{ height }}>
          <div className="cal-times" aria-hidden="true">
            {hourMarks.map((m, i) => (
              <span key={m} style={{ top: i * HOUR_PX }}>{i === 0 || i === hourMarks.length - 1 ? "" : formatTime(`${String(Math.floor(m / 60)).padStart(2, "0")}:00`)}</span>
            ))}
          </div>
          {WEEKDAYS.map(d => {
            const laid = layoutDay(events.filter(e => e.day === d));
            return (
              <div key={d} className="cal-col" style={{ backgroundSize: `100% ${HOUR_PX}px` }}>
                {laid.map(({ item: e, lane, lanes }) => {
                  const top = ((e.start - rangeStart) / 60) * HOUR_PX;
                  const h = Math.max(MIN_EVENT_PX, ((e.end - e.start) / 60) * HOUR_PX - 2);
                  const label = `${e.kind === "fixed" ? "Fixed commitment" : "Work session"}: ${e.title}${e.kind === "work" && e.subtitle ? `, goal ${e.subtitle}` : ""}, ${WEEKDAY_NAMES[d]} ${formatRange(e.startTime, e.endTime)}`;
                  return (
                    <div
                      key={e.id} className={`cal-event ${e.kind}`} aria-label={label} title={label} role="img"
                      style={{
                        top, height: h, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`,
                        background: e.color.bg, color: e.color.text, borderColor: e.color.border,
                      }}
                    >
                      <span className="cal-event-title">{e.kind === "fixed" && <em>Fixed · </em>}{e.title}</span>
                      {h >= 38 && <span className="cal-event-time">{formatRange(e.startTime, e.endTime)}</span>}
                      {h >= 56 && e.kind === "work" && e.subtitle && <span className="cal-event-goal">{e.subtitle}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <ul className="cal-legend" aria-label="Legend">
        <li><span className="swatch work" /> Work session (colour = goal)</li>
        <li><span className="swatch fixed" /> Fixed commitment (dashed)</li>
      </ul>
    </div>
  );
}
