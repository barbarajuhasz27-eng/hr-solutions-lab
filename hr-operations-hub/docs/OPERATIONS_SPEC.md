# HR Operations Hub — Consolidated Product & Implementation Specification

**Version:** 1.1 (for approval) · **Date:** 03.11.2026 · **Base:** `main` @ `107ce78`
**Status:** Specification only. No application code changes until this document is approved.

This document consolidates the Phase 1 redesign proposal and the decisions taken on it. Where it conflicts with `PRODUCT_BRIEF.md`, `PROCESS_MODEL.md` or `DATA_AND_PRIVACY.md`, this document wins. Those documents are updated in the final implementation PR. The privacy boundaries in `DATA_AND_PRIVACY.md` remain in force and are extended in section 10.

---

## 0. Decision log

| # | Decision | Source |
|---|---|---|
| D1 | Visual direction **C: calm desk, loud recovery**. Calm, analytical, time-oriented workspace. Rapid Recovery is a distinct high-contrast mode. No visual resemblance to Smart Onboarding. | Approved |
| D2 | Navigation: **Today · Calendar · Portfolio · People · Playbooks**. Recurring operations live in Portfolio (definitions, rules, ownership) and Calendar (actual and projected occurrences). No separate "Recurring" section. | Approved |
| D3 | MVP playbooks: **Training Session**, **Monthly Payroll Input Coordination**, **Monthly HR Reporting**. Onboarding coordination is explicitly *not* an MVP playbook (covered by Smart Onboarding). | Approved |
| D4 | English UI with DACH conventions: 24-hour time, `DD.MM.YYYY`, ISO calendar week ("KW"), time zone Europe/Vienna. Built so that localisation can follow. | Approved |
| D5 | **HR Systems & Digital Operations** added as an explicit operational area. IT coordination stays a cross-cutting dimension. | Requirement A |
| D6 | Positioning: **HR Operations Management Workspace for Lean HR Teams**. The calendar is one view, not the product. | Requirement B |
| D7 | The schedule engine is working-day aware from the MVP onward, with **configurable working week, statutory public holidays and company closures**. A maintained Austrian holiday database comes later. | Requirement C |
| D8 | Statutory public holidays and company closures are **separate kinds** of entry. 24.12. and 31.12. are never treated as Austrian public holidays, but either can be configured as a company closure. | Review of v1.0 |
| D9 | The **working week, daily working hours, public holidays and company closures are all configurable**. Nothing is hard-coded. Working-day calculations (dates) and working-hour calculations (time budgets) are separate. | Review of v1.0 |
| D10 | Working-day counting conventions are defined precisely (6.2a) and pinned by expected-date tests. | Review of v1.0 |
| D11 | The payroll and reporting playbooks in Appendix A are **draft assumptions**. They are not implemented until you have reviewed them. | Review of v1.0 |
| D12 | Demo working-time defaults are **Monday–Friday, 08:00–12:00 and 13:00–17:00** (eight effective working hours with a one-hour lunch break). Demo company closures are **24.12. and 31.12.**, seeded as removable company-specific closures, never statutory public holidays. All defaults remain configurable. | User confirmation, 04.11.2026 |
| D13 | Monthly Payroll Input Coordination is **provider-neutral**. No universal cut-off rule is assumed; the provider's actual cut-off date and time are configured for the operation and may be adjusted for an individual occurrence without changing the recurring schedule. | User confirmation, 04.11.2026 |
| D14 | When a payroll-relevant input misses the cut-off or a correction is identified after handover, the demo workflow records it for **following month's payroll run as an Aufrollung** (retroactive payroll adjustment), following the configured provider's process. Urgent exceptions are escalated rather than silently deferred. The Hub tracks the coordination; it does not calculate payroll or determine legal treatment. | User's HR experience, 04.11.2026 |
| D15 | Payroll input reconciliation is a **four-eyes control**. The backup is the default second reviewer, but the owner may assign another qualified HR person. The reviewer must be independent of the person who prepared the payroll input. If no second reviewer is available, a documented owner self-check is an exception and must not be labelled as a completed four-eyes control. | User confirmation, 04.11.2026 |
| D16 | HRIS master-data validation checks each approved, payroll-relevant change against the actual HRIS entry, including its effective date and payroll-period treatment. The Hub records only the check status and open follow-up items, never the personal change details. | User confirmation, 04.11.2026 |
| D17 | Monthly HR Reporting is a **coordination playbook**, not an analytics engine. The Hub does not calculate headcount, FTE, joiner/leaver or turnover metrics and does not store report values or employee-level data. The Head of HR review is important but **does not block delivery**; if it is still pending at dispatch, the owner may send the report marked 'Not reviewed' and record the outstanding review. No universal percentage threshold is assumed for data variances. | User confirmation, 04.11.2026 |
| D18 | Cost-centre mapping is a **standard, essential input** for the monthly HR report. If Finance & Controlling has not confirmed the current mapping by the deadline, the previous month's mapping may be used as a documented fallback, clearly flagged in the report and retained as an open follow-up. | User confirmation, 04.11.2026 |

---

## 1. Product definition

> **HR Operations Hub is an HR Operations Management Workspace for lean HR teams.** It manages the team's portfolio of recurring responsibilities and one-off activities, turns each into dated work with a named owner and backup, explains what puts a deadline at risk, supports recovery when something slips, and keeps an execution history the team can learn from.

**Primary users:** HR Generalists, HR Operations Specialists and HR Coordinators in HR teams of roughly 1–8 people (organisations of about 150–2,000 employees), plus the Head of HR as a reviewer of the portfolio.

**Product hypothesis (to validate, not a claim):** HR-specific playbooks, explicit ownership, working-day-aware recurrence and explainable recovery create a more coherent operational workspace than generic task or project tools.

**Boundaries:** the Hub coordinates and records completion. It does not calculate pay, store salary values, store absence reasons or health data, send messages, book resources or change other systems.

---

## 2. HR Operations taxonomy

Ten operational areas. Each operation belongs to exactly one area. Areas are shown as a two-letter code with the area name on hover and in filters. Colour is never used for areas, only for operational state.

| Code | Area | Covers | MVP playbook |
|---|---|---|---|
| LC | Employee Lifecycle | Employee changes, transfers, probation checkpoints, offboarding, exit administration. (Onboarding is covered by Smart Onboarding.) | — |
| PC | Payroll & Compensation | Monthly payroll input coordination, variable pay collection, salary review rounds, bonus cycles, post-payroll checks. Coordination only. | Monthly Payroll Input Coordination |
| TB | Time, Absence & Benefits | Absence administration, leave coordination, benefits enrolment windows, insurance changes. No health or absence reasons. | — |
| DA | HR Data & Administration | Employee master data checks, personnel file completeness, document administration, recurring data maintenance. | — |
| SD | **HR Systems & Digital Operations** | HRIS administration coordination, system changes, release coordination, user-acceptance testing, data interfaces, access coordination, HR system vendor activities. | — |
| TP | Talent & Performance | Goal setting, review cycles, calibration, talent reviews, promotion rounds. | — |
| LD | Learning & Development | Training sessions, training calendar, mandatory training follow-up, learning reporting. | Training Session |
| RW | Reporting & Workforce | Monthly HR report, headcount, turnover, workforce data validation, quarterly and annual reporting. | Monthly HR Reporting |
| PG | Policy & Governance | Policy review cycles, approvals, publication, works council coordination deadlines, documentation reviews. No claim of legal compliance. | — |
| CE | Communication & Events | Employee information sessions, HR announcements, manager briefings, workshops. | — |

**Boundary between DA and SD:** DA is about the *content* of HR data (is the data complete and correct?). SD is about the *systems and interfaces* that hold and move it (is the system configured, tested, released and accessible?).

**Counterparties (cross-cutting dimension, not an area):** Finance & Controlling · Sales Operations · Line managers · IT Service Desk · Facilities · External payroll provider · HR system vendor · Works council · External trainer. A counterparty can be responsible for a task, a contributor to it, or the party a task is waiting on. Filtering by counterparty works across all areas ("everything we are waiting on from Finance").

---

## 3. Final navigation and routes

Top bar (48 px), left to right: product mark · five sections · exception strip · demo clock and reset · current user chip ("Sophie Lang · HR Generalist", simulated).

| Section | Route | Purpose |
|---|---|---|
| Today | `/` (alias `/today`) | Daily command view: agenda from overdue to end of week, week grid, decisions needed, next cut-offs, active cover arrangements. |
| Calendar | `/calendar` | All occurrences over time: month view and 13-week cut-off timeline. Generated and projected occurrences. Working-time settings (working week, hours, public holidays, company closures). |
| Portfolio | `/portfolio` | All operations: area, cadence, owner and backup, next occurrence, history. |
| — Operation detail | `/portfolio/[operationId]` | Definition, schedule rule with preview, ownership, playbook version, occurrence history. Edit schedule and ownership. |
| People | `/people` | Responsibilities per person and counterparty, unavailability, cover, unassigned tasks. |
| Playbooks | `/playbooks` | Library of process definitions by area. |
| — Playbook detail | `/playbooks/[playbookId]` | Tasks on an offset scale, roles, criticality, fallbacks, completion criteria. "Use as one-off" or "Use as recurring operation". |
| Occurrence | `/o/[occurrenceId]` | One execution: status, next actor, task timeline/table, responsibilities, inputs outstanding, readiness reasons, history, close-out. |
| Recovery mode | `/o/[occurrenceId]/recovery` | Full-screen, high-contrast exception workspace for one occurrence. |

**Exception strip:** three counters: *Overdue* (unresolved tasks past their due time), *At risk* (occurrences with readiness At risk or Recovery), *Waiting on others* (tasks on a Waiting hold). Each counter is a link that opens Today filtered to those items. A counter at zero is shown muted, not hidden.

All screens are client-rendered from the local store. Dynamic routes resolve their id from the store and show a designed "not found in this demo" state when the id does not exist.

---

## 4. Domain model

### 4.1 Overview

```
WorkCalendar ─┐
              ├─> Schedule ──> Operation ──> Occurrence ──> Task
Playbook ─────┘ (TaskTemplate[])     │            │
                                     │            ├── Coverage[]
Person / Counterparty ───────────────┘            └── HistoryEvent[]
```

- A **Playbook** defines *how* a process runs.
- An **Operation** is *a responsibility the team has* (one-off or recurring) that uses a playbook version.
- A **Schedule** says *when* a recurring operation runs. A one-off operation has no schedule.
- An **Occurrence** is *one execution* with its own anchor date and a **snapshot** of tasks and assignments.
- A **Task** is one actionable step inside an occurrence.

### 4.2 Entities

Types are illustrative TypeScript. Field names are binding for implementation unless a PR review agrees a change.

```ts
type ISODate = string;     // "2026-11-23" (local calendar date, Europe/Vienna)
type ISODateTime = string; // UTC instant, "2026-11-23T11:00:00.000Z"

interface Person {
  id: string;                      // "p-sophie"
  name: string;                    // fictional
  roleTitle: string;               // "HR Generalist"
  unavailable: { id: string; from: ISODate; to: ISODate }[]; // all-day, inclusive; no reason stored
}

interface Counterparty {
  id: string;                      // "cp-finance"
  name: string;                    // "Finance & Controlling"
  kind: "internal-team" | "external-provider" | "manager-group";
  contactName?: string;            // fictional, optional
}

type Assignee =
  | { kind: "person"; personId: string }
  | { kind: "counterparty"; counterpartyId: string };

type RoleRef =                     // used in templates only
  | { kind: "owner" } | { kind: "backup" }
  | Assignee
  | { kind: "unassigned" };        // allowed for non-essential tasks only

type Offset = { amount: number; unit: "workingDays" | "calendarDays" | "hours" | "minutes" };
type Window = Offset;              // same shape, amount >= 0

interface TaskTemplate {
  id: string;                      // stable within playbook versions
  title: string;
  description: string;
  offset: Offset;                  // relative to the occurrence anchor; negative = before
  dueTime?: string;                // "HH:mm" local, for day-based offsets; default = anchor time
  ownerRole: string;               // display label, e.g. "Payroll", "Facilities"
  responsible: RoleRef;
  contributors?: Assignee[];       // counterparties providing input
  criticality: "essential" | "important" | "optional";
  estimatedMinutes: number;        // effort, not lead time
  dependsOn: string[];             // TaskTemplate ids
  fallback?: string;
}

interface Playbook {
  id: string;                      // "monthly-payroll-input"
  version: number;                 // increments on content change
  title: string;
  area: AreaCode;
  status: "available" | "in-design";
  purpose: string;
  trigger: string;                 // human-readable start condition
  anchorKind: "event-start" | "deadline";
  anchorLabel: string;             // "Training starts", "Provider cut-off", "Report delivery"
  leadTime: Offset;                // when the occurrence becomes active
  attentionWindow: Window;         // "due soon" threshold
  recoveryWindow: Window;          // when Recovery mode is recommended
  completionCriteria: string[];
  tasks: TaskTemplate[];
}

interface Operation {
  id: string;
  title: string;                   // "Monthly payroll input"
  area: AreaCode;
  playbookId: string;
  playbookVersion: number;         // used for newly generated occurrences
  ownerId: string;                 // accountable, always a Person
  backupId?: string;               // Person, must differ from owner
  schedule: Schedule | null;       // null = one-off
  status: "active" | "paused" | "retired";
  createdAt: ISODateTime;
}

interface Schedule {
  frequency: "weekly" | "monthly" | "quarterly" | "annually";
  interval: number;                // 1 = every period, 2 = every second period
  rule: ScheduleRule;
  anchorPeriodOffset: 0 | 1;       // 1 = anchor falls in the period *after* the one the work covers
                                   //     (October HR report → delivered 04.11.2026); periodKey stays "2026-10"
  time: string;                    // "12:00" local
  weekendShift: "previous-working-day" | "next-working-day" | "none"; // for date-based rules
  startDate: ISODate;
  endDate?: ISODate;
  versions: ScheduleVersion[];     // history of rule changes, see 6.6
}

type ScheduleRule =
  | { kind: "dayOfMonth"; day: number }                       // 1–31, clamped to month length
  | { kind: "nthWorkingDay"; n: number }                      // 3 = 3rd working day of the month
  | { kind: "workingDaysBeforeMonthEnd"; n: number }          // 5 = last working day minus 5 working days
  | { kind: "weekday"; weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7 }   // ISO weekday, weekly schedules
  | { kind: "monthAndDay"; month: number; day: number };      // quarterly uses month within quarter (1–3), annually month 1–12

interface Occurrence {
  id: string;                      // `${operationId}:${periodKey}`
  operationId: string;
  periodKey: string;               // "2026-11", "2026-W45", "2026-Q4", "2026", or "once"
  anchorKind: "event-start" | "deadline";
  anchorAt: ISODateTime;
  originalAnchorAt?: ISODateTime;  // set when moved manually
  calendarDrift?: ISODateTime;     // rule now yields a different date (see 6.7)
  status: "scheduled" | "active" | "completed" | "completed-late" | "missed" | "skipped" | "cancelled";
  playbookId: string;
  playbookVersion: number;
  ownerId: string;                 // snapshot of operation owner at generation
  backupId?: string;               // snapshot
  eventDetails?: { location: string };   // event-start occurrences only
  tasks: Task[];                   // snapshot, see 4.3
  coverage: Coverage[];
  closedAt?: ISODateTime;
  closeNote?: string;              // required for missed and skipped
  reviewNote?: string;
  playbookFeedback?: boolean;      // "playbook needs a change"
  history: HistoryEvent[];
}

interface Task {
  id: string;                      // = template id
  title: string; description: string; ownerRole: string;
  dueAt: ISODateTime;              // resolved at generation, recalculated only per 6.6/6.7
  responsible: Assignee | { kind: "unassigned" };
  contributors: Assignee[];
  criticality: "essential" | "important" | "optional";
  estimatedMinutes: number;
  dependsOn: string[];
  fallback?: string;
  status: "not-started" | "in-progress" | "waiting" | "blocked" | "done" | "skipped";
  hold?: { kind: "waiting" | "blocked"; waitingOn?: string; note?: string; since: ISODateTime };
  completionNote?: string;
  fallbackUsed?: boolean;
}

interface Coverage {
  id: string;
  absentPersonId: string;
  coveringPersonId: string;
  from: ISODate; to: ISODate;      // inclusive
  createdAt: ISODateTime;
}

interface HistoryEvent {
  id: string;
  at: ISODateTime;
  actorId: string;                 // the simulated current user
  kind:
    | "generated" | "activated" | "task-completed" | "task-reopened" | "hold-set" | "hold-released"
    | "fallback-used" | "task-reassigned" | "coverage-added" | "coverage-removed"
    | "moved" | "skipped" | "closed" | "recovery-decision" | "calendar-drift-applied" | "migrated";
  taskId?: string;
  detail: Record<string, string | number | boolean>; // structured, rendered via the message catalogue
}

type ISOWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;      // 1 = Monday

interface WorkCalendar {
  timeZone: "Europe/Vienna";
  workingWeek: ISOWeekday[];                          // default [1, 2, 3, 4, 5]
  workingHours: Partial<Record<ISOWeekday, { start: string; end: string }[]>>;
                                                      // "HH:mm" local; one or more ordered, non-overlapping
                                                      // working intervals per weekday. Breaks are gaps.
                                                      // Demo default Mon–Fri: 08:00–12:00, 13:00–17:00.
  publicHolidays: {
    date: ISODate; name: string;
    source: string;                                   // e.g. "ARG § 7 Abs. 2"
    verified: boolean;                                // false until someone has checked it against the source
  }[];
  companyClosures: { date: ISODate; name: string }[]; // company-specific full-day non-working days
  updatedAt: ISODateTime;
}
```

### 4.3 Snapshot rule

When an occurrence is generated it copies, at that moment, the playbook's tasks (with `dueAt` resolved from the anchor), the operation's owner and backup, and the playbook version. After that:

- Editing the playbook, the operation's owner/backup or the schedule **never** changes a started, closed or skipped occurrence.
- A generated occurrence that has **not started** (no task beyond `not-started`, no history except `generated`) is regenerated when its operation's schedule, playbook version or owner changes, and when the work calendar changes (6.6, 6.7).

### 4.4 Store

One versioned client store (`hr-operations-hub-demo-v3`):

```ts
interface StoreV3 {
  version: 3;
  savedAt: ISODateTime;
  modified: boolean;
  calendar: WorkCalendar;
  people: Person[];
  counterparties: Counterparty[];
  playbooks: Playbook[];           // read-only in MVP, shipped with the app; stored for version history
  operations: Operation[];
  occurrences: Occurrence[];
}
```

All changes go through named actions in a reducer (`completeTask`, `setHold`, `releaseHold`, `useFallback`, `reassignTask`, `addCoverage`, `moveOccurrence`, `skipOccurrence`, `closeOccurrence`, `updateSchedule`, `updateOwnership`, `updateCalendar`, `createOperation`, …). Every action that changes an occurrence appends a `HistoryEvent`. Pure engine functions never read the clock. They receive `now`.

---

## 5. Responsibility and backup logic

### 5.1 Roles

| Role | Count | Lives on | Rule |
|---|---|---|---|
| Accountable owner | exactly 1 | Operation, snapshotted to occurrence | Always a Person. Owns the outcome and the close-out. |
| Backup | 0–1 | Operation, snapshotted | A Person different from the owner. Takes over only through an explicit hand-over (Coverage). |
| Responsible | exactly 1 per task | Task | Person or Counterparty. Defaults from the template (`owner` resolves to the owner, `backup` to the backup). |
| Contributor | 0–n per task | Task | Counterparties that provide input. Informational, plus "Waiting on" suggestion. |
| Approver | — | — | **Not in MVP.** Approval steps are modelled as normal review tasks (e.g. "Review by Head of HR"). |

`unassigned` is allowed only for non-essential tasks. An essential task can never be unassigned. Creation forms and the reducer reject it.

### 5.2 Effective responsible

For a task in an occurrence:

1. If the responsible is a Person, and a Coverage on that occurrence has `absentPersonId` equal to that person and the task's due date falls within `from–to`, the **effective responsible** is the covering person. The task shows "Daniel Hofer · covering for Sophie Lang".
2. Otherwise the effective responsible is the task's responsible.

The task's stored `responsible` is never overwritten by cover. Removing the coverage restores the original assignment. Reassigning a task (a deliberate change) does overwrite `responsible` and is logged as `task-reassigned`.

The **effective owner** of an occurrence follows the same rule using the anchor date.

### 5.3 Next actor

Each occurrence shows exactly one "Next" line, derived as follows:

1. Consider unresolved tasks (not `done` or `skipped`). Prefer essential, then important, then optional. Within a criticality, take the earliest `dueAt`.
2. Skip tasks whose prerequisites are unresolved, unless *all* candidates are waiting on prerequisites. Then take the first prerequisite in the chain.
3. For the chosen task:
   - on a **Waiting** hold → next actor is the `waitingOn` party (free text, or a matching counterparty name);
   - on a **Blocked** hold → next actor is the effective owner ("decision needed");
   - otherwise → the effective responsible.
4. If no unresolved tasks remain and the occurrence is open → next actor is the effective owner ("close the occurrence").

### 5.4 Unavailability and hand-over

- A person can be marked unavailable for one or more all-day date ranges. **No reason is collected or stored.**
- On saving, the Hub lists affected open occurrences: tasks whose effective responsible is that person with `dueAt` in the range, and occurrences they own with the anchor in the range.
- "Hand over to backup" creates one Coverage per affected occurrence, with that occurrence's backup as covering person. Occurrences without a backup, or where the backup is also unavailable, are listed as **"needs a cover decision"** with a person picker.
- A new readiness reason, `owner-unavailable`, applies to unresolved essential tasks whose effective responsible is unavailable on the due date: a *risk* inside the attention window, *attention* otherwise.

---

## 6. Recurrence and working-day rules

### 6.1 Working days

A **working day** is a calendar date in Europe/Vienna that:

- falls on a weekday in `workingWeek`,
- is not in `publicHolidays`, and
- is not in `companyClosures`.

**Three separate configuration layers.** All are edited in **Calendar → Working time**.

| Layer | What it is | Default | Notes |
|---|---|---|---|
| Working week | Weekdays on which the team works | Mon–Fri | Any combination of weekdays |
| Statutory public holidays | Holidays defined by law, each with a source | Austrian list below | Shown as "Public holiday" |
| Company closures | Company-specific full-day non-working days | none | Shown as "Company closure". The Calendar offers 24.12. and 31.12. as one-click suggestions, but does not pre-select them |

**24.12. and 31.12. are not statutory public holidays in Austria.** They are not in the § 7 Abs. 2 ARG list. Many organisations still close on these days, or close in the afternoon under a collective agreement or company practice. The Hub therefore lets each of them be configured independently as a company closure. Half-day closures are not modelled in the MVP. A company that closes in the afternoon either enters a full closure or leaves the day as a working day.

**Statutory list and source.** The 13 Austrian public holidays are defined in **§ 7 Abs. 2 Arbeitsruhegesetz (ARG), BGBl. Nr. 144/1983**. The official consolidated text is in the Rechtsinformationssystem des Bundes (RIS):
<https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008541>

The law lists nine fixed dates and four movable feasts that depend on Easter. It does not publish calendar dates per year. The dates below were derived from Easter Sunday (05.04.2026 and 28.03.2027) and entered by hand:

| Holiday (ARG § 7 Abs. 2) | Rule | 2026 | 2027 |
|---|---|---|---|
| Neujahr (New Year) | fixed | Thu 01.01. | Fri 01.01. |
| Heilige Drei Könige (Epiphany) | fixed | Tue 06.01. | Wed 06.01. |
| Ostermontag (Easter Monday) | Easter + 1 | Mon 06.04. | Mon 29.03. |
| Staatsfeiertag (Labour Day) | fixed | Fri 01.05. | Sat 01.05. |
| Christi Himmelfahrt (Ascension) | Easter + 39 | Thu 14.05. | Thu 06.05. |
| Pfingstmontag (Whit Monday) | Easter + 50 | Mon 25.05. | Mon 17.05. |
| Fronleichnam (Corpus Christi) | Easter + 60 | Thu 04.06. | Thu 27.05. |
| Mariä Himmelfahrt (Assumption) | fixed | Sat 15.08. | Sun 15.08. |
| Nationalfeiertag (National Day) | fixed | Mon 26.10. | Tue 26.10. |
| Allerheiligen (All Saints) | fixed | Sun 01.11. | Mon 01.11. |
| Mariä Empfängnis (Immaculate Conception) | fixed | Tue 08.12. | Wed 08.12. |
| Christtag (Christmas Day) | fixed | Fri 25.12. | Sat 25.12. |
| Stefanitag (St Stephen's Day) | fixed | Sat 26.12. | Sun 26.12. |

Not included: Good Friday (no longer a general holiday) and the "persönlicher Feiertag" under § 7a ARG. The latter is an individual leave entitlement, not a non-working day for the team.

**Manual-verification warning.**

- Every seeded entry starts with `verified: false`.
- While any public holiday in the generation horizon is unverified, Calendar shows a persistent banner: "Public holidays for 2026–2027 were entered manually and have not been checked against the official source. Deadlines that depend on them may be wrong."
- The banner links to the RIS source. Affected occurrences show a small "unverified calendar" marker.
- *Mark as verified* (per year) records who confirmed the list and when, and removes the warning for that year. The warning is not removed in code until you have checked the list.

**Missing years.** When an occurrence's generation horizon reaches a year with **no public-holiday entries**, the Hub shows a stronger warning: "No public holidays configured for 2028; working-day deadlines may be wrong". It appears on Calendar and on each affected occurrence.

### 6.1a Working hours

Working hours are a **separate layer** from working days, with their own module and tests:

| Module | Answers | Used by | Never uses |
|---|---|---|---|
| `lib/calendar/working-days.ts` | Is this date a working day? Which date is n working days before or after? | Schedule anchors (6.2), task due dates (6.3), working-day windows (7) | Times of day, working hours |
| `lib/calendar/working-hours.ts` | How many working minutes lie between two instants? | Recovery effort budget and "time left" countdowns (7, 9.6) | It asks `working-days` whether a date is working, but does not define it |

- Working hours are configured per working weekday (`workingHours`) as one or more ordered, non-overlapping intervals. The demo default is Monday–Friday, 08:00–12:00 and 13:00–17:00: eight effective working hours per day, with 12:00–13:00 treated as a non-working lunch break. Both intervals and the working week can be changed in Calendar → Working time.
- Changing working hours **never moves a deadline**. It only changes the reported time budget and the recovery grouping.
- A due time outside working hours is allowed. The 12:00 payroll cut-off is a date-and-time fact, not a working-hours calculation.
- If a working weekday has no hours configured, it contributes zero working minutes, and the settings panel flags it.

### 6.2 Anchor calculation

For a recurring operation and a period:

1. Determine the nominal **local date** from the rule:
   - `dayOfMonth(d)`: day `d` of the month, clamped to the last day (31 → 30.11.).
   - `nthWorkingDay(n)`: the n-th working day of the month. Validation: n ≤ number of working days. Otherwise the occurrence is flagged and not generated.
   - `workingDaysBeforeMonthEnd(n)`: last working day of the month, then n working days earlier (precise convention in 6.2a).
   - `weekday(w)`: weekday `w` of the ISO week.
   - `monthAndDay(m, d)`: month m (of quarter or year), day d, clamped.
2. For date-based rules (`dayOfMonth`, `weekday`, `monthAndDay`), apply `weekendShift` if the date is not a working day. Working-day rules already land on working days.
3. Combine with `schedule.time` in Europe/Vienna and convert to UTC (DST-correct).

### 6.2a Counting conventions (binding)

All counting is on working days as defined in 6.1. Calendar days that are not working days are skipped and never counted.

| Expression | Convention | In words |
|---|---|---|
| `nthWorkingDay(n)` | Count forward from the 1st of the month. The first working day of the month is **number 1**. | "3rd working day" = the third working day of the month. |
| `workingDaysBeforeMonthEnd(n)` | Let *L* be the last working day of the month. *L* is **position 0 and is not counted**. Step back n working days from *L*. | "5 working days before month end" = the working day with **exactly 5 working days of the same month after it**. Equivalently, the 6th-last working day of the month. |
| Task offset `−n workingDays` | The anchor date is **position 0 and is not counted**. Step back n working days. | "−1 WD" = the previous working day. "0 WD" = the anchor date itself. |
| Task offset `+n workingDays` | Same, forward. | "+2 WD" = the second working day after the anchor date. |
| Anchor on a non-working day (manual move only) | Still position 0. −1 WD is the last working day strictly before it. | — |
| Working-day windows (7) | "Within 2 working days" means: the current local date is at most 2 working days before the anchor date, counted with the same convention. | — |

Times of day do not affect any of these counts. The due time is applied after the date has been determined.

**Worked example, November 2026 (AT 2026, Mon–Fri week, no closures).** The last working day is Mon 30.11. (position 0). Counting back: Fri 27. (1), Thu 26. (2), Wed 25. (3), Tue 24. (4), **Mon 23.** (5). Anchor: **Mon 23.11.2026 12:00**.

**Worked example, December 2026.** Non-working days in all variants: Sat/Sun, Fri 25.12., Sat 26.12. (public holidays). The company-closure configuration changes the result:

| Scenario | Last working day *L* (position 0) | Counting back 1…5 | Anchor |
|---|---|---|---|
| D1 · no company closures | Thu 31.12. | Wed 30. · Tue 29. · Mon 28. · Thu 24. · **Wed 23.** | **Wed 23.12.2026 12:00** |
| D2 · closures 24.12. **and** 31.12. | Wed 30.12. | Tue 29. · Mon 28. · Wed 23. · Tue 22. · **Mon 21.** | **Mon 21.12.2026 12:00** |
| D3 · closure 24.12. only | Thu 31.12. | Wed 30. · Tue 29. · Mon 28. · Wed 23. · **Tue 22.** | **Tue 22.12.2026 12:00** |
| D4 · closure 31.12. only | Wed 30.12. | Tue 29. · Mon 28. · Thu 24. · Wed 23. · **Tue 22.** | **Tue 22.12.2026 12:00** |

### 6.2b Reference results (become unit tests in M2)

Each row is an expected-date test. The calendar is AT public holidays with a Mon–Fri working week unless stated.

| # | Rule | Period | Company closures | Expected |
|---|---|---|---|---|
| T1 | workingDaysBeforeMonthEnd(5), 12:00 | 11/2026 | none | Mon **23.11.2026** 12:00 |
| T2 | same | 12/2026 | none (D1) | Wed **23.12.2026** 12:00 |
| T3 | same | 12/2026 | 24.12. + 31.12. (D2) | Mon **21.12.2026** 12:00 |
| T4 | same | 12/2026 | 24.12. only (D3) | Tue **22.12.2026** 12:00 |
| T5 | same | 12/2026 | 31.12. only (D4) | Tue **22.12.2026** 12:00 |
| T6 | nthWorkingDay(3), anchorPeriodOffset 1, 10:00 | 10/2026 | none | Wed **04.11.2026** 10:00 (01.11. is a Sunday and a holiday; Mon 02. = 1, Tue 03. = 2, Wed 04. = 3) |
| T7 | same | 12/2026 | none | Thu **07.01.2027** 10:00 (Fri 01.01. and Wed 06.01. are holidays; Mon 04. = 1, Tue 05. = 2, Thu 07. = 3) |
| T8 | same | 12/2026 | 31.12. only | Thu **07.01.2027** 10:00 (a December closure does not affect January) |
| T9 | dayOfMonth(31), next-working-day shift | 11/2026 | none | Mon 30.11.2026 (clamped, already a working day) |
| T10 | dayOfMonth(15), previous-working-day shift | 08/2026 | none | Fri 14.08.2026 (15.08. is a Saturday and a holiday) |

Task due-date tests (6.3) for the payroll anchor:

| # | Anchor | Closures | Offset | Expected date |
|---|---|---|---|---|
| T11 | Mon 23.11.2026 | none | −6 WD | Fri 13.11.2026 |
| T12 | Mon 23.11.2026 | none | 0 WD | Mon 23.11.2026 |
| T13 | Mon 21.12.2026 (D2) | 24.12. + 31.12. | −2 WD | Thu 17.12.2026 |
| T14 | Mon 21.12.2026 (D2) | 24.12. + 31.12. | +2 WD | Wed 23.12.2026 |
| T15 | Mon 21.12.2026 (D2) | 24.12. + 31.12. | +4 WD | Tue 29.12.2026 |
| T16 | Wed 23.12.2026 (D1) | none | +2 WD | Mon 28.12.2026 |
| T17 | Wed 23.12.2026 (D1) | none | +4 WD | Wed 30.12.2026 |

Working-hour tests (6.1a, separate test file):

| # | From → to | Working hours | Expected working minutes |
|---|---|---|---|
| T18 | Fri 18.12.2026 16:00 → Mon 21.12.2026 12:00 | 08:00–12:00, 13:00–17:00 Mon–Fri | 60 + 240 = **300** |
| T19 | same | 07:00–12:00, 13:00–15:30 Mon–Fri | 0 + 240 = **240**, because Friday 16:00 is outside hours; Monday contributes 08:00–12:00 |
| T20 | Wed 23.12.2026 09:00 → Mon 28.12.2026 12:00, closure 24.12. and statutory holiday 25.12. | 08:00–12:00, 13:00–17:00 Mon–Fri | 420 + 240 = **660** |
| T21 | any change to working hours | — | anchors and task due dates in T1–T17 are unchanged |

### 6.3 Task due dates

For each task template:

- `workingDays`: move from the anchor's local date by `amount` working days (negative = earlier, 0 = anchor date). Time = `dueTime` or the anchor time. Example: payroll anchor Mon 23.11. 12:00, offset −6 working days → Fri 13.11. 12:00.
- `calendarDays`: move by calendar days. If the result is not a working day, move to the previous working day.
- `hours` / `minutes`: exact duration from the anchor instant (event playbooks).

Deadline playbooks use working-day offsets. Event playbooks use minute or hour offsets. Mixing within one playbook is allowed.

### 6.4 Generation, activation and projection

- **Generation horizon:** weekly operations generate occurrences up to 90 days ahead. Monthly ones generate the current and next two periods. Quarterly and annual ones generate the current and next period. Generation runs on app load and on each clock tick, and is idempotent (occurrence id = `operationId:periodKey`).
- **Projection:** beyond the horizon, Calendar shows *projected* occurrences computed on the fly. They are not stored, have no tasks and are drawn hatched.
- **Activation:** an occurrence is `scheduled` until `anchor − leadTime` or the first task due date, whichever is earlier. Then it becomes `active` (history: `activated`).
- **Start/end dates and pause:** no occurrences are generated before `startDate`, after `endDate`, or while the operation is `paused`. Pausing does not delete generated occurrences. They remain and can be skipped.

### 6.5 Moving, skipping, closing

- **Move:** the user picks a new anchor date and time for one occurrence. `originalAnchorAt` keeps the rule date. Task due dates are recalculated from the new anchor for unresolved tasks only. Logged as `moved`. A move onto a non-working day requires confirmation.
- **Skip:** requires a reason (≤ 160 characters). Status `skipped`, kept in history, excluded from on-time statistics but shown as a hollow dot.
- **Close:** always an explicit user action, never automatic.
  - `completed`: all essential tasks resolved, closed at or before the anchor.
  - `completed-late`: all essential tasks resolved, closed after the anchor.
  - `missed`: closed with unresolved essential tasks. Requires a note.
  - `cancelled`: one-off operations only, requires a note.
- **Overdue occurrences do not block** the next one. Both are shown. The older one shows "carried over" on Calendar and Today.

### 6.6 Changing a schedule

A schedule change (rule, time, interval, weekend shift) creates a `ScheduleVersion { effectiveFrom: ISODate, rule, time, ... }`.

- Occurrences with an anchor before `effectiveFrom`: untouched.
- Generated, **not started** occurrences with an anchor on or after `effectiveFrom`: regenerated with the new rule.
- **Started** occurrences on or after `effectiveFrom`: kept. They show "Schedule changed: new rule gives DD.MM.YYYY" with an *Apply new date* action, which moves the occurrence and is logged.
- The edit form shows a preview of the next three anchors before saving.

### 6.7 Changing the work calendar

When the working week, public holidays or company closures change (working hours do not affect dates, see 6.1a):

- Not-started generated occurrences are recalculated.
- Started occurrences whose rule would now give a different anchor get `calendarDrift` set and show "Calendar changed: rule now gives DD.MM.YYYY". *Apply* moves the anchor (logged `calendar-drift-applied`), *Keep* clears the drift flag.
- Closed and skipped occurrences are never recalculated.

### 6.8 Period keys and calendar weeks

- Period keys: monthly `YYYY-MM`, weekly `YYYY-Www` (ISO week-year), quarterly `YYYY-Qn`, annual `YYYY`, one-off `once`.
- Calendar week numbers follow ISO 8601. Reference tests: 03.11.2026 → KW 45; 31.12.2026 → KW 53 (2026); 01.01.2027 → KW 53 (2026); 04.01.2027 → KW 1 (2027).
- DST reference tests: anchors on 29.03.2026 and 25.10.2026 resolve to the correct UTC instant.

---

## 7. Readiness and Rapid Recovery on occurrences

The current, tested rules are kept and applied per occurrence, with three generalisations:

1. **Anchor instead of start time.** All rules read `anchorAt`. For deadline playbooks the anchor is the cut-off or delivery time.
2. **Windows per playbook.** `attentionWindow` and `recoveryWindow` replace the fixed 24 hours and 60 minutes. Working-day windows are measured in working days.

   | Playbook | Attention window | Recovery window |
   |---|---|---|
   | Training Session | 24 hours | 60 minutes |
   | Monthly Payroll Input Coordination | 1 working day | 2 working days |
   | Monthly HR Reporting | 1 working day | 1 working day |

3. **Reasons as codes.** The engine returns `{ code, severity, taskId?, params }` instead of English sentences. The UI renders them from a message catalogue (localisation-ready). Existing codes stay: `start-passed` (renamed `anchor-passed`), `blocked`, `deadline-passed`, `waiting-near-deadline`, `insufficient-time`, `dependency-risk`, `waiting`, `due-soon`. New codes: `owner-unavailable`, `calendar-drift`, `calendar-missing-holidays`.

**Status precedence stays as today:** anchor passed with open essentials → At risk. Inside the recovery window with open essentials → Recovery. Any risk reason → At risk. Any attention reason → Needs attention. Otherwise → Preparing, or Ready when nothing is open.

**Rapid Recovery groups:**

| Group | Rule | Change from today |
|---|---|---|
| Must do now | Essential, unblocked, fits the remaining time budget | Budget is effort minutes. For deadline playbooks the time left is the number of working minutes until the anchor, calculated by `working-hours` from the configured working hours (6.1a). |
| Can simplify | Essential that does not fit and has a fallback; important with a fallback | — |
| Needs someone else | Waiting / blocked holds, open prerequisites, essential without fallback that does not fit, effective responsible unavailable | Adds the unavailable case, with "Hand over" and "Reassign" actions |
| After the anchor | Optional tasks, important tasks without fallback, and tasks with a positive offset (e.g. post-payroll check) | Renamed from "Can follow up later". Includes post-anchor tasks. |

Every recovery action (fallback, reassign, hand over, postpone past anchor, escalation note) writes a `recovery-decision` history event shown in the **decision log**. "Note escalation" records text only. Nothing is sent.

> Working hours are only used for the effort budget and the countdown. Whether an occurrence is in its recovery or attention window is decided in working **days**, so changing working hours never changes readiness status or deadlines. It can only move tasks between "Must do now" and "Can simplify". Event playbooks (Training Session) use plain elapsed minutes, not working hours.

---

## 8. Design system

### 8.1 Principles

- **Time is the primary axis.** Agenda, week grid and timelines come before counts.
- **Colour means state, nothing else.** Areas and people are never colour-coded.
- **State is never conveyed by colour alone.** Every state also has an icon or shape and a text label.
- **Rules and tables over cards.** Hairline dividers and column alignment create structure. Bordered panels are used only for elements that are separate objects (the agenda, the week grid, side panels).
- **Recovery is a different place.** Leaving the calm workspace for the dark recovery mode is a deliberate, visible switch.
- **No resemblance to Smart Onboarding:** no left sidebar, no warm cream, no teal accent, no Inter, no metric tile grid, no large rounded cards.

### 8.2 Tokens

Workspace, light (default):

| Token | Value | Use |
|---|---|---|
| `--surface-page` | `#F6F7F9` | page background (cool paper) |
| `--surface-panel` | `#FFFFFF` | agenda, tables, panels |
| `--surface-sunken` | `#EEF1F4` | table headers, closed items |
| `--ink` | `#18212C` | primary text |
| `--ink-muted` | `#5F6B7B` | secondary text (≥ 4.5:1 on panel) |
| `--line` | `#DDE2E8` | dividers |
| `--line-strong` | `#18212C` | section rules, week-grid header rule |
| `--accent` | `#2457C5` | links, focus, today marker, selected tab (signal blue) |
| `--state-due` / `-soft` | `#9A5F06` / `#FBF0DC` | due soon (attention) |
| `--state-wait` / `-soft` | `#6E4FAE` / `#F0EBF9` | waiting on others |
| `--state-risk` / `-soft` | `#B2401F` / `#FBE7E0` | overdue, at risk |
| `--state-blocked` | `#8E2A1A` | blocked (with ban icon) |
| `--state-ok` | `#2F7A55` | on track, done marker |
| `--state-done` | `#8E98A4` | done text, closed occurrence |

Workspace, dark (follows system or toggle): same token names, values tuned for ≥ 4.5:1 (e.g. page `#12161C`, panel `#191E26`, ink `#E6EAF0`, accent `#7EA6FF`, risk `#FF8A68`).

Recovery mode (always dark, independent of theme):

| Token | Value | Use |
|---|---|---|
| `--rc-page` | `#0D1117` | background |
| `--rc-panel` | `#161C25` | cards |
| `--rc-ink` / `--rc-muted` | `#F2F4F7` / `#9AA4B2` | text |
| `--rc-hot` / `--rc-hot-soft` | `#FF6B4A` / `#3A1D17` | mode label, must-do-now column |
| `--rc-amber` | `#F0B349` | can simplify |
| `--rc-violet` | `#B9A1FF` | needs someone else |
| `--rc-calm` | `#8FC4FF` | after the anchor |

### 8.3 Typography

| Role | Face | Sizes |
|---|---|---|
| Display and headings | IBM Plex Sans Condensed 600/700 | 34 (page), 26 (section), 20 (panel), 16 (row group) |
| Body and UI | IBM Plex Sans 400/500/600 | 14 (default), 13 (dense tables), 12 (meta) |
| Data | IBM Plex Mono 400/500 | dates, times, KW, durations, period keys, area codes; 11–13; recovery countdown 40–56 |

Fonts are loaded with `next/font` (self-hosted at build, no runtime third-party requests). Numbers use `tabular-nums`. Uppercase labels only in Plex Mono, at 11 px, with 0.06–0.08em letter-spacing.

### 8.4 Shape, spacing, layout

- Spacing on a 4 px base (4, 8, 12, 16, 24, 32, 48).
- Radius 4 px for controls and pills, 6 px for panels. No radius above 8 px.
- Shadows only on overlays (dialogs, popovers).
- Top bar 48 px. Content max width 1440 px. Desktop-first 12-column grid with 24 px gutters.
- Breakpoints: ≥ 1280 full layout · 960–1279 side panels collapse below main · 600–959 tablet, week grid scrolls horizontally inside its container · < 600 phone, agenda only, week grid replaced by a day list, nav collapses to a menu button.

### 8.5 State vocabulary

| State | Indicator | Label example |
|---|---|---|
| Upcoming | hollow circle, ink-muted | "Due Fr 13.11. 12:00" |
| Due soon | clock icon, `--state-due` | "Due today 14:00" |
| Waiting | hourglass, `--state-wait` | "Waiting on Finance · 1 d" |
| Blocked | ban icon, `--state-blocked` | "Blocked · decision needed" |
| Overdue / at risk | triangle, `--state-risk` | "Overdue 2 d" |
| Done | check, `--state-done`, strikethrough | "Done 12.11. 09:14" |
| Skipped occurrence | dashed outline | "Skipped · system freeze" |
| Projected occurrence | diagonal hatch | "Projected" |
| Covered | person-swap icon | "Daniel Hofer · covering" |

### 8.6 Formatting and localisation

- One module `lib/format.ts` formats everything visible: `DD.MM.YYYY`, short `DD.MM.`, `HH:mm`, weekday short ("Mo", "Tu"), `KW 45`, durations ("2 d 4 h", "45 min").
- Settings object `{ locale: "en-GB", timeZone: "Europe/Vienna", weekStartsOn: 1 }`. No component formats dates itself.
- UI strings that are built from data (reasons, history events, notices) come from `lib/messages/en.ts`, keyed by code. Static labels stay in components for the MVP. Full string extraction comes with real localisation.

### 8.7 Core components

`TopBar` · `ExceptionStrip` · `AgendaList` · `WeekGrid` · `CutoffTimeline` · `MonthGrid` · `OccurrenceHeader` (with NextActor) · `TaskTimeline` · `TaskTable` · `HoldForm` · `ReasonList` · `ResponsibilityPanel` · `HistoryLog` · `DotHistory` · `ScheduleEditor` (with anchor preview) · `CalendarSettings` · `PersonRow` · `CoverDialog` · `RecoveryBoard` · `DecisionLog` · `CloseOccurrenceDialog` · `EmptyState` · `DemoBanner`.

---

## 9. Screen layouts

Every screen has a designed empty state, and a "data could not be loaded, demo restored" state for corrupt storage. The app is fully client-side, so there is no loading state beyond the initial hydration placeholder.

### 9.1 Today (`/`)
- **Header row:** "Tuesday, 03.11.2026 · KW 45", filter chips (Mine · All · by area · by counterparty).
- **Left (5/12): Agenda.** Groups: Overdue · Today · each remaining working day of the week · "Later this week". Row: state stripe, due time (mono), task title, occurrence and area code, effective responsible or next actor. Inline actions: complete, Waiting / blocked.
- **Right (7/12): Week grid.** Rows = open occurrences touching this week. Columns = Mon–Fri working days (non-working days shown narrow and hatched). Bars from first to last task due this week, diamond on the anchor, today line.
- **Footer band (full width):** Needs a decision (occurrences At risk or in Recovery, top reason, *Open recovery*) · Next cut-offs (next 30 days) · Cover arrangements active this week.
- **Empty:** "Nothing due this week. Next cut-off: …".

### 9.2 Portfolio (`/portfolio`)
- Table grouped by area (collapsible). Columns: Operation · Cadence in words ("Monthly · 5 working days before month end · 12:00") · Owner / Backup · Next anchor · Current occurrence state · Last 6 (DotHistory: filled = on time, half = late, ring = skipped, cross = missed).
- Actions: *New operation* (from playbook) · row → operation detail.
- **Operation detail:** definition summary, ScheduleEditor with preview of the next three anchors, ownership editor, playbook version, occurrence list (newest first), pause or retire.
- Definition shown on screen: "On time = closed at or before its anchor." No percentages in the MVP.

### 9.3 Calendar (`/calendar`)
- Toggle: **Timeline** (default) · **Month**.
- **Timeline:** 13 weeks, KW header, one row per operation: lead-time bar ending in an anchor diamond. Generated = solid, projected = hatched, moved = diamond with a ghost marker at the original date, skipped = dashed, overdue = pinned to a "carried over" column at the left.
- **Month:** grid with anchors and holidays (named) per day.
- **Working time** panel (button in header), with four separate sections:
  1. Working week: weekday toggles.
  2. Working hours: start and end per working weekday.
  3. Public holidays: by year, with source, verification status and *Mark year as verified*.
  4. Company closures: add, edit and remove, with suggestions for 24.12. and 31.12.

  The panel also shows the unverified and missing-year warnings, and a preview of how the next three anchors per operation change before saving.
- Occurrence actions from the popover: Open · Move · Skip.

### 9.4 Playbooks (`/playbooks`, `/playbooks/[id]`)
- **List:** grouped by area, each with status (Available / In design), version, anchor type, lead time, task count.
- **Detail:** purpose, trigger, anchor label, windows, completion criteria. Task sequence on an offset scale (working days or hours) with dependency connectors, plus a table: task, offset, responsible default, contributors, criticality, effort, fallback.
- **Use as one-off:** title, anchor date and time, location (events), owner, backup, task-level responsible overrides, optional tasks can be removed.
- **Use as recurring operation:** title, frequency and rule, time, start date, owner, backup, preview of the next three anchors.
- Playbooks are read-only in the MVP.

### 9.5 Occurrence (`/o/[id]`)
- **Header:** operation title · period ("November 2026") · anchor label and date ("Provider cut-off · Mo 23.11.2026 12:00 · in 14 working days") · status · readiness · **Next actor** · *Open recovery* when At risk or in Recovery.
- **Main (8/12):** TaskTimeline (offset axis to the anchor, dependency connectors) with a Table toggle. Task row actions: complete, Waiting / blocked, release, use fallback, reassign.
- **Side (4/12):** Responsibilities (owner, backup, cover), Inputs outstanding (tasks with contributors or Waiting holds), Readiness reasons.
- **Bottom:** HistoryLog (newest first, filterable by task).
- **Close-out:** *Close occurrence* opens a dialog with the computed outcome, required note where applicable, review note and "playbook needs a change". Afterwards the occurrence is read-only, with a summary (late tasks, hold durations, fallbacks, recovery decisions).

### 9.6 Recovery mode (`/o/[id]/recovery`)
- Full-screen dark. **Header:** "RECOVERY MODE", occurrence title, owner and cover, what happens at the anchor. Countdown in mono, measured in working hours for deadline playbooks ("1 d 02 h to cut-off · Mo 23.11.2026 12:00").
- **Four columns:** Must do now · Can simplify · Needs someone else · After the anchor. Each card: title, effective responsible, effort, *why* (rendered reason), actions.
- **Decision log** pinned at the bottom.
- *Leave recovery* returns to the occurrence. When no essential task is open, the header shows "Essentials covered. You can leave recovery".

### 9.7 People (`/people`)
- Rows for people, then counterparties. Columns: Owns (operations) · Backup for · Next 4 weeks (task count per KW, essential count highlighted) · Overdue · Unavailable (bars on the 4-week scale).
- **Unassigned** section: non-essential tasks without a responsible.
- Actions: *Mark unavailable* (dates only) → CoverDialog listing affected occurrences → *Hand over to backup* / pick cover for "needs a cover decision".
- No hours, no scores, no ranking.

---

## 10. MVP scope

### 10.1 Included

1. New identity and navigation (sections 3, 8). Dark theme for the workspace, recovery mode always dark.
2. Domain model v3, reducer with history, migration (sections 4, 11).
3. Configurable working time: working week, daily working hours, statutory public holidays (with source and verification status) and company closures, plus unverified and missing-year warnings (6.1, 6.1a).
4. Schedule engine: one-off, weekly, monthly, quarterly, annual. Rules `dayOfMonth`, `nthWorkingDay`, `workingDaysBeforeMonthEnd`, `weekday`, `monthAndDay`. Weekend shift, generation horizon, projection, activation (6.2–6.4).
5. Move, skip, close, schedule versions, calendar drift (6.5–6.7).
6. Readiness and recovery on occurrences with per-playbook windows and reason codes (7).
7. Owner, backup, responsible, contributors, next actor, unavailability, coverage (5).
8. Three playbooks (Appendix A). Payroll and reporting are implemented only after your HR review of the draft assumptions.
9. Screens: Today, Portfolio and operation detail, Calendar with working-day settings, Playbooks with both "use" flows, Occurrence with close-out, Recovery mode, People.
10. Synthetic seed: 4 HR people, 9 counterparties, the three operations with plausible history (Appendix B).
11. Demo banner, reset demo, stale-demo handling adapted to recurrence (11.4).

### 10.2 Explicitly excluded from the MVP

- Additional playbooks, including onboarding coordination (covered by Smart Onboarding).
- Playbook editing, custom task creation outside playbooks, playbook version management UI.
- Approver role and approval states.
- Custom recurrence beyond the five rules (e.g. "every second Tuesday", RRULE import).
- A maintained or automatically updated holiday database, regional or church holidays, and holiday calculation from Easter (dates are entered, not computed).
- Half-day closures, split working hours, breaks, shift patterns and per-person working time.
- Workload capacity in hours, bottleneck analytics, "consistently late" insights, trend charts and percentages.
- Notifications, reminders, email, calendar, Teams, HRIS, payroll provider or IT integrations.
- Authentication, multiple real users, permissions, backend, database, export or import.
- Any payroll figures, salary data, absence reasons or health data.
- Full UI localisation (only formatting and data-driven messages are prepared).
- Deployment or any change to Vercel or Smart Onboarding.

---

## 11. Data migration from the current version

### 11.1 Starting point

The current app stores `hr-operations-hub-demo-v2` (`{ version: 2, savedAt, modified, activities }`) and may still find legacy `hr-operations-hub-demo-v1`. The existing `resolveStoredDemo` already handles v1 → v2 and the stale-demo shift.

### 11.2 Procedure

1. Read v3. If valid → use it (11.4 applies).
2. Else run the existing v1/v2 resolution (including stale handling) to obtain v2 activities and the `modified` flag.
3. If `modified` is false → build a fresh v3 seed. Nothing is lost.
4. If `modified` is true → build a fresh v3 seed **without** its training occurrences, then convert each v2 activity (11.3) and add it. Show a notice: "Your earlier demo changes were kept and moved into the new workspace."
5. Write v3, then remove v2 and v1 keys only after a successful write.

### 11.3 Field mapping (v2 activity → v3)

| v2 | v3 |
|---|---|
| Activity | one-off `Operation` (`schedule: null`, area LD, playbook `training-session` v2) + one `Occurrence` (`periodKey: "once"`, `anchorKind: "event-start"`) |
| `startsAt` | `occurrence.anchorAt` |
| `location` | `occurrence.eventDetails.location` |
| `coordinator` ("Sophie Lang") | `ownerId: "p-sophie"` on operation and occurrence |
| `completedAt` | `status: "completed"`, `closedAt` |
| otherwise | `status` derived: `active` if the lead time has started, else `scheduled` |
| ActionInstance | Task with `offset: { amount: dueOffsetMinutes, unit: "minutes" }` and `dueAt` resolved from the anchor |
| `ownerRole` HR, HR / Trainer | `responsible: owner` (person) |
| `ownerRole` Facilities / IT / Trainer | counterparty Facilities (contact Mara Klein) / IT Service Desk (Jonas Weber) / External trainer (Alex Morgan) |
| `status`, `statusNote`, `waitingOn`, `fallbackUsed` | `status`; `hold { kind, waitingOn, note, since: savedAt }` for waiting/blocked; `completionNote`; `fallbackUsed` |
| — | `history: [{ kind: "migrated", at: now }]` |

### 11.4 Stale demo with recurring operations

The v2 rule (shift all dates by the time away) is correct for events but **wrong for recurring operations**, whose dates come from the calendar. In v3:

- **Untouched stale demo** (away > 30 min, `modified` false) → fresh seed.
- **Modified stale demo:** one-off occurrences are shifted by the time away, as today. Recurring occurrences keep their real dates. Generation then runs for the current date, so missing periods are generated and older open ones become carried over. Notice explains both.
- The seed builds recurring scenarios relative to the current date (Appendix B), so a fresh demo always shows the designed situations.

### 11.5 Migration tests

v1 → v3 and v2 → v3, modified and untouched; holds, notes and fallbacks preserved; completed activity becomes a closed occurrence; corrupt v2 → fresh seed; keys removed only after write; repeated loads are idempotent.

---

## 12. Implementation sequence

Each milestone is **one pull request** from its own branch off the latest `main` (`feature/ops-m<n>-<topic>`). Every PR must:

- keep all existing tests passing, or replace them with stricter equivalents and explain why in the description;
- add tests for all new business logic;
- pass `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` locally and in CI;
- touch only `hr-operations-hub/` (plus root portfolio docs where stated);
- stop for your review. No merge by me, no deployment.

| PR | Scope | Acceptance criteria |
|---|---|---|
| **S** (this document) | `docs/OPERATIONS_SPEC.md`, README link | You approve the specification. |
| **M0 · Identity and shell** | Tokens, fonts via `next/font`, top bar, exception strip, routes (`/`, `/calendar`, `/portfolio`, `/people`, `/playbooks`, `/o/[id]`, `/o/[id]/recovery`). The current activity, playbook and recovery views ported to the new shell. Calendar, Portfolio and People show honest "coming in M6/M7/M9" states. | All 51 current tests pass unchanged. Every existing feature works at its new URL. No left sidebar, cream, teal or Inter. Light and dark workspace, recovery always dark. Browser review by you. |
| **M1 · Domain model v3 and store** | Types, reducer actions with history events, v3 storage, migration (11), `lib/format.ts`, message catalogue. | Migration tests (11.5) pass. Every reducer action has a test asserting its history event. Format tests: `DD.MM.YYYY`, 24 h, KW. |
| **M2 · Working time and schedule engine** | `working-days` and `working-hours` as separate modules. Working week, working hours, public holidays (with source and `verified`), company closures. All five rules with the 6.2a counting conventions, weekend shift, Europe/Vienna conversion, generation horizon, projection, activation, period keys. | Expected-date tests T1–T17 (6.2b) pass, including all four December closure scenarios. Working-hour tests T18–T21 pass. KW and DST tests (6.8) pass. 24.12. and 31.12. are not in the public-holiday seed. The `working-days` module does not import `working-hours`. Generation is idempotent. Pausing and end dates are respected. **The holiday seed stays `verified: false` until you have checked it against RIS.** |
| **M3 · Readiness and recovery on occurrences** | Engine anchored on `anchorAt`, offset units, per-playbook windows, working-minute budget, reason codes, new codes. | Training scenario behaves exactly as today (ported tests). Payroll occurrence enters Recovery 2 working days before cut-off, not early over a weekend or holiday. Changing working hours changes the budget but not readiness status (tested). Recovery groups include post-anchor tasks in "After the anchor". |
| **M4 · Responsibility** | People, counterparties, owner/backup validation, effective responsible, next actor, unavailability, coverage, `owner-unavailable`. | Next actor correct for: plain, waiting, blocked, covered, all-prerequisites-open and nothing-open cases. Removing coverage restores assignments. Essential tasks cannot be unassigned. No absence reason field exists. |
| **M5 · Playbooks and "use" flows** | **Precondition: your written HR review of Appendix A.2 and A.3, with any changes incorporated into this spec first.** Then author payroll and reporting playbooks as reviewed, Training Session v2, library, detail, one-off and recurring creation flows with anchor preview. | Implemented task lists match the reviewed Appendix A exactly. Created operations generate correct occurrences. Optional tasks can be removed, essential cannot. |
| **M6 · Today and Portfolio** | Agenda, week grid, footer band, filters. Portfolio table, DotHistory, operation detail with ScheduleEditor (versions, preview) and ownership editor. | Every count in the exception strip is a working filter. Schedule edit regenerates only not-started occurrences (tested). Dot history matches closed occurrence outcomes. |
| **M7 · Calendar** | Timeline and month views, projection drawing, move and skip, carried-over column, working-time settings, calendar drift, missing-year warning. | Generated, projected, moved, skipped and carried-over occurrences are visually distinct. Holiday change recalculates not-started occurrences and flags started ones (tested). |
| **M8 · Occurrence, Recovery mode, close-out** | Occurrence workspace, task timeline and table, history log, recovery board with decision log, close dialog and summary. | One full payroll month can be executed, recovered and closed in the demo. Close outcomes follow 6.5. Closed occurrences are read-only. Every recovery action appears in the decision log. |
| **M9 · People, responsive and accessibility, docs** | People view, cover dialog, unassigned queue. Responsive pass at the four breakpoints. Accessibility pass (keyboard, focus, contrast, labels). Update README, PRODUCT_BRIEF, PROCESS_MODEL, DATA_AND_PRIVACY. | Browser review on desktop, tablet and phone in both themes. Text contrast ≥ 4.5:1. All actions keyboard-operable. Docs describe only implemented behaviour. |

**Ordering rationale:** the identity ships first so every later PR can be reviewed visually. The model, calendar and engine (M1–M4) come before screens, because incorrect deadlines would undermine every screen built on them.

---

## Appendix A · MVP playbooks

Offsets are relative to the anchor and follow the counting conventions in 6.2a.

> **DRAFT — HR REVIEW REQUIRED BEFORE IMPLEMENTATION.**
> A.2 and A.3 are draft assumptions for a synthetic organisation. They are not validated processes or universal standards. Everything in these tables is an assumption: anchor rule, lead time, windows, task list, offsets, owners, contributors, criticality, effort, dependencies and fallbacks. That applies especially to the columns marked †. Nothing in A.2 or A.3 is implemented until you have reviewed it and the reviewed version has been written back into this document. Until then, M0–M4 use only the Training Session playbook and neutral test fixtures.

Review status:

| Playbook | Status | Reviewer |
|---|---|---|
| A.1 Training Session | Existing and in use; mapping only | — |
| A.2 Monthly Payroll Input Coordination | **Draft, not reviewed** | You (HR) |
| A.3 Monthly HR Reporting | **Draft, not reviewed** | You (HR) |

### A.1 Training Session (v2, event-start)
Anchor "Training starts". Lead time 7 days. Attention 24 h, recovery 60 min. The seven existing tasks are unchanged (trainer, participants, room, IT setup, reminder, materials, attendance follow-up), with offsets converted to minutes and responsibilities mapped as in 11.3.

### A.2 Monthly Payroll Input Coordination (v1, deadline) — DRAFT

Area PC. All values below are draft assumptions:

| Parameter | Draft assumption | To confirm |
|---|---|---|
| Anchor | "Provider cut-off", configured using the actual provider-specific date rule and time | Configure the provider's actual cut-off; no universal formula or fixed time is assumed. Adjust individual occurrences when a provider calendar differs. |
| Lead time | 15 working days | When the cycle should start |
| Attention / recovery window | 1 / 2 working days | When the team needs warning |
| Owner / backup | HR Generalist / HR Operations Specialist | Who is accountable and who covers |
| Completion criteria | Input file handed over by cut-off; collected changes reconciled; post-cut-off or otherwise late payroll-relevant items recorded for following month's payroll run as an Aufrollung with an owner and follow-up; provider pre-payroll checks reviewed and open corrections documented | What "done" means |

| # | Task | Offset † | Responsible † | Contributor † | Crit. | Effort | Depends on | Fallback † |
|---|---|---|---|---|---|---|---|---|
| 1 | Send input request for the period | −12 WD | Owner | Line managers, Sales Ops | important | 20 | — | Send a short plain reminder with the cut-off date |
| 2 | Collect employee changes (joiners, leavers, changes) | −8 WD | Owner | — | essential | 60 | — | Use the HR change log as of today; record any omitted payroll-impacting change for following month's payroll run as an Aufrollung; escalate urgent exceptions |
| 3 | Collect variable pay inputs | −6 WD | Sales Ops | — | essential | 30 | 1 | Record missing inputs for following month's payroll run as an Aufrollung under the provider's process; escalate urgent exceptions |
| 4 | Collect overtime and allowance approvals | −5 WD | Line managers | — | essential | 40 | 1 | Submit approved items only; record outstanding approved items for following month's payroll run as an Aufrollung; escalate urgent exceptions |
| 5 | Verify approved master-data changes in the HRIS | −4 WD | Owner | — | essential | 45 | 2 | Verify each approved payroll-relevant change against the HRIS entry, including its effective date and treatment in the correct payroll period. Record only the check status and open follow-up items in the Hub, not personal change details. If time is constrained, prioritise high-impact changes (joiners and leavers), log the remaining checks as open, and follow them up; record payroll-impacting omissions for the following month's payroll run as an Aufrollung where appropriate |
| 6 | Confirm payroll-relevant time and absence inputs from approved system outputs | −3 WD | Owner | — | important | 20 | 2 | Record unresolved payroll-relevant inputs for following month's payroll run as an Aufrollung; do not record absence reasons, diagnoses or medical details |
| 7 | Independently reconcile payroll input against approved source inputs (four-eyes check) | −2 WD | Backup (default; may be reassigned to another qualified HR person) | — | essential | 45 | 2, 3, 4, 5, 6 | If no independent reviewer is available by cut-off, the owner performs and documents a self-check as an exception; record that the four-eyes control was not completed and escalate according to internal policy |
| 8 | Hand over input file to payroll provider | 0 WD 12:00 | Owner | External payroll provider | essential | 15 | 7 | Record any payroll-relevant item not accepted before cut-off for following month's payroll run as an Aufrollung; escalate urgent exceptions under the provider's process |
| 9 | Review provider's pre-payroll check report | +2 WD | Owner | External payroll provider | important | 30 | 8 | Record unresolved corrections for following month's payroll run as an Aufrollung where an in-period correction is not agreed; escalate urgent or material errors with the provider |
| 10 | Consolidate late inputs and corrections for the following month's payroll Aufrollung | +4 WD | Owner | — | essential | 30 | 2, 3, 4, 5, 6, 9 | Keep unresolved items in a carry-forward register with a named owner and next-period follow-up; escalate items not accepted by the provider |

### A.3 Monthly HR Reporting (v1, deadline) — DRAFT

Area RW. All values below are draft assumptions:

| Parameter | Draft assumption | To confirm |
|---|---|---|
| Anchor | "Report delivery", rule `nthWorkingDay(3)` with `anchorPeriodOffset: 1` (delivered in the month after the reporting month), 10:00 | Agreed delivery date and recipients |
| Lead time | 3 working days | When preparation should start |
| Attention / recovery window | 1 / 1 working day | When the team needs warning |
| Owner / backup | HR Generalist / HR Coordinator | Who is accountable and who covers |
| Completion criteria | Report delivered to the agreed recipients; identified data issues recorded for follow-up; Head of HR review completed or explicitly marked pending at dispatch | What "done" means |

| # | Task | Offset † | Responsible † | Contributor † | Crit. | Effort | Depends on | Fallback † |
|---|---|---|---|---|---|---|---|---|
| 1 | Extract HRIS data after month-end close | −2 WD 09:00 | Owner | — | essential | 30 | — | Use the last validated extract and mark the date |
| 2 | Validate aggregate headcount and FTE against previous month | −2 WD 15:00 | HR Coordinator | — | essential | 45 | 1 | Validate aggregate totals using the organisation's agreed definitions; flag unexplained or material variances for follow-up using an organisation-defined threshold where one exists. No universal percentage threshold is assumed |
| 3 | Confirm cost-centre mapping | −1 WD 12:00 | Finance & Controlling | — | essential | 20 | 1 | Use previous month's mapping and flag it in the report |
| 4 | Prepare joiner, leaver and turnover figures from validated reporting data | −1 WD 16:00 | Owner | — | important | 40 | 2 | Prepare and report available joiner and leaver figures; mark turnover as unavailable where the validated source data or agreed definition is not ready |
| 5 | Prepare report pack and commentary | 0 WD 08:00 | Owner | — | essential | 60 | 3, 4 | Send tables without commentary |
| 6 | Review report by Head of HR (important, non-blocking) | 0 WD 09:00 | Head of HR | — | important | 20 | 5 | If review is still pending at dispatch, the owner may deliver the report marked "Not reviewed" and record the outstanding review. This task is not a prerequisite for task 7 |
| 7 | Deliver report to recipients | 0 WD 10:00 | Owner | — | essential | 10 | 5 | Deliver at the agreed deadline even if task 6 remains pending; mark the report "Not reviewed" and record the open review follow-up |
| 8 | Log identified data issues for HRIS correction (if any) | +2 WD | Owner | HR system vendor | optional | 15 | 7 | Record each identified issue as a high-level follow-up with an owner; do not copy report values or employee-level details into the Hub |

---

## Appendix B · Synthetic seed (built relative to the current date)

- **People:** Sophie Lang (HR Generalist, simulated current user), Daniel Hofer (HR Operations Specialist), Lena Gruber (HR Coordinator), Katrin Mayr (Head of HR). All fictional.
- **Counterparties:** Finance & Controlling, Sales Operations, Line managers, IT Service Desk (contact Jonas Weber), Facilities (contact Mara Klein), External payroll provider, HR system vendor, Works council, External trainer (contact Alex Morgan). All fictional.
- **Operations:**
  - Monthly payroll input (owner Sophie, backup Daniel). Last three periods closed: on time, late (recovery used), on time. Current period active with variable pay inputs *Waiting on Sales Ops* and one overtime approval overdue.
  - Monthly HR reporting (owner Sophie, backup Lena). Two previous periods closed on time. Current period due within 2 working days, cost-centre mapping *Waiting on Finance & Controlling*.
  - Training "Leading through change" (one-off, starts 45 minutes after seeding: the existing rescue scenario).
  - Training "Excel essentials for managers" (one-off, in 4 days, partly prepared).
  - Training "HR systems refresher" (one-off, closed 5 days ago).
- **Working time:**
  - Monday–Friday, 08:00–12:00 and 13:00–17:00 (eight effective working hours; 12:00–13:00 is a non-working lunch break).
  - These are demo defaults only; working weekdays and daily working intervals are editable in Calendar → Working time.
  - Austrian public holidays 2026–2027 (6.1), `verified: false`.
  - Company closures 24.12.2026 and 31.12.2026, labelled "Demo company closure". Both are seeded as removable company-specific closures, not statutory public holidays.
- **Unavailability:** Sophie Lang unavailable on 2 working days within the current payroll period, without hand-over yet, so the cover flow can be demonstrated.

---

## Appendix C · Open points for review

1. **Appendix A.2 and A.3 (blocking for M5):** anchor rules, lead times, windows, task lists, offsets, owners, contributors and fallbacks are draft assumptions requiring your HR review.
2. **Public-holiday seed (blocking for marking it verified):** check the 2026–2027 dates in 6.1 against § 7 Abs. 2 ARG in RIS. M2 can be merged with the list unverified, but the warning stays visible until you confirm it.
3. **Resolved demo working-time defaults (04.11.2026):** Monday–Friday, 08:00–12:00 and 13:00–17:00 (eight effective hours, with a non-working lunch break from 12:00–13:00). The working week and intervals remain configurable in the app.
4. **Resolved demo company closures (04.11.2026):** seed 24.12.2026 and 31.12.2026 as individually removable company-specific closures. They must not be represented as Austrian statutory public holidays.
