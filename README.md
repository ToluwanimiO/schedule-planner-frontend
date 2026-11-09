# Weekwell — goal-to-timetable planner (frontend)

A React + TypeScript + Vite multi-step wizard that turns goals, tasks, availability and fixed commitments into a
Monday–Sunday timetable, with a summary and a downloadable PDF report. The UI is separated from the scheduling
engine by a small adapter, so your greedy and beam-search optimizer can be plugged in without touching components.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start the dev server (http://localhost:5173)
npm test           # run unit tests (vitest)
npm run typecheck  # TypeScript project check
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

Dependencies added to the original project: `jspdf`, `jspdf-autotable` (PDF), `vitest` (tests, dev only).

## The six steps

1. **Goals** – add, rename, remove (removing a goal asks first and also removes its tasks; nothing is orphaned).
2. **Tasks** – title, goal, weekly target (15-min steps), priority, optional firm deadline (day + time), split rule with
   minimum session, optional daily maximum, preferred days and time of day. Invalid values are reported, never silently changed.
3. **Availability** – any number of windows per weekday; fixed commitments (weekly on any combination of weekdays, or one-off
   on a date). Presets *Every day / Weekdays / Weekends / Clear* just set the selection; each day stays toggleable.
   The planning week (Monday-start) is chosen here; one-off commitments only apply inside it.
4. **Preferences** – strategy (priority-first, deadline-first, balanced progress) in plain language, hard constraints vs soft
   preferences explained, per-task soft preferences editable, engine selector (greedy / optimizer).
5. **Review** – readable summary, blocking errors with links back to the step, non-blocking warnings (for example work exceeds free time).
6. **Timetable** – loading / error / empty / success states, calendar and agenda views, summary, unscheduled work with reasons,
   Download PDF, Regenerate, Edit plan. If inputs change after generation the result is flagged as out of date and PDF download is paused.

## Architecture

```
src/
├── App.tsx                      composes the wizard only
├── hooks/useSchedulePlanner.ts  all state, navigation, validation, generation (no rendering, no scheduling logic)
├── domain/                      types.ts (shared types), constants.ts, defaults.ts
├── scheduler/
│   ├── types.ts                 SchedulerEngine / SchedulerAdapter interfaces, error classes
│   ├── schedulerAdapter.ts      the only door between UI and engines; verifies every result
│   ├── engines.ts               registry: mode -> engine   <-- plug your real algorithms in here
│   ├── verifyResult.ts          independent hard-constraint checker for any ScheduleResult
│   └── demoGreedyEngine.ts      DEMO engine (see below)
├── utils/
│   ├── timeUtils.ts             all time/date conversion + formatting
│   ├── commitments.ts           expand weekly/one-off commitments into occurrences
│   ├── intervals.ts             free-time computation
│   ├── scheduleValidation.ts    input validation (errors block; warnings don't)
│   ├── scheduleSummary.ts       ScheduleResult -> ScheduleSummary (used by UI *and* PDF)
│   ├── calendarLayout.ts        overlap lanes + visible range (used by UI *and* PDF)
│   └── exportSchedulePdf.ts     PDF generation (jsPDF + autotable), lazy-loaded on click
├── components/                  layout/ goals/ tasks/ availability/ preferences/ review/ schedule/ common/
└── __tests__/                   vitest unit tests
```

Conventions: weekdays are ISO numbers, **Monday = 1 … Sunday = 7**. Times in state are `"HH:mm"` 24-hour strings (`"24:00"` is
allowed only as an end-of-day marker); conversion to minutes and to display text (`9:30 AM`) lives in `timeUtils.ts`.
Dates are `YYYY-MM-DD`. Entities have stable string IDs. Overnight events/windows are **not supported** and are rejected with a message
(split them at 12:00 AM).

Data flow: `useSchedulePlanner` → `schedulerAdapter.generate(input, mode)` → `ScheduleResult` → `buildSummary(input, result)`.
The calendar, agenda, summary, unscheduled list and PDF all consume that same result/summary snapshot.

## Connecting your real scheduler

**Important: the uploaded project contained no real scheduling code** — only a placeholder inside the old `schedulerAdapter.ts`.
So the real greedy and beam-search algorithms are **not connected**:

- `greedy` is served by `demoGreedyEngine.ts`, a small greedy scheduler written only so the UI runs end to end.
  Its results are tagged `provenance.kind === "demo"`; the timetable shows a "Demo result" banner and the PDF prints the same notice.
- `optimizer` has **no engine**. It is shown as "Not connected yet" and cannot be selected. Nothing falls back silently to another algorithm.

To connect an algorithm: implement `SchedulerEngine` (`scheduler/types.ts`) — map `SchedulingInput` to your engine's input, call it,
map the output to `ScheduleResult` with `provenance: { kind: "real", engine: "…" }` — and register it in `scheduler/engines.ts`.
The adapter runs `verifyResult` on every result and throws `InvalidScheduleError` (shown to the user, no timetable) if availability,
commitments, deadlines, minimum sessions, daily maximums or no-split rules are violated. For unscheduled work, supply `reasons`
only when your engine can actually tell why; the UI shows "no reason reported" otherwise and never invents one.

## PDF report

Landscape A4: overview (title, week, strategy, stats, constraints table) → Monday–Sunday calendar page → sessions table →
commitments → task breakdown (requested vs scheduled) → unscheduled work with reasons. Tables repeat headers across pages; every
page has "Page X of Y". Filename: `weekly-plan-<Monday date>.pdf`. Errors are shown to the user.
jsPDF's built-in fonts cover Latin-1 only; other characters (for example Yoruba dot-below letters) are simplified in the PDF
(ọ → o, or `?`) and the user is told. The on-screen plan is never altered.

## Known limitations

- State is in memory only (a refresh clears the plan).
- 15-minute granularity for targets, sessions and times.
- No overnight events; one planning week at a time.
- Optimizer mode needs your engine (above). The demo greedy engine is not your algorithm and makes no optimality claims.
