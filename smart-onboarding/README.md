# Smart Onboarding
### Employee Experience & HR Process Intelligence

**Live demo:** https://hr-solutions-lab.vercel.app/

**Employee Experience · HR Process Design · Cross-functional Workflow Design**

Smart Onboarding is an independent HR process design and digital product development project. It is a working web prototype that covers onboarding from offer acceptance to Day 90, built around one shared onboarding case with two sides:

- **Employee Portal:** a personal view of the new hire's first 90 days, with their steps, learning, pulse surveys, check-ins and agreed actions.
- **HR workspace:** rule-based readiness, cross-team dependencies and blockers, learning and check-in oversight, and aggregate reporting with written KPI definitions.

The prototype runs locally in the browser on a fictional company and synthetic demo data. It has no sign-in, no backend and no integrations. It is not a production HR system and does not replace an HRIS or an LMS.

## Status

**Feature-complete prototype, prepared for release.** The original Readiness & Process Intelligence MVP and all four Employee Experience phases are implemented:

1. Employee Portal and Demo Mode
2. Learning Center
3. Feedback, check-ins, scheduling and action plans
4. Experience & Process Intelligence reporting

Typecheck, lint, 332 automated tests and the production build pass. No user testing has been conducted, and no business outcome is claimed. Screenshots have not been captured yet (see [Screenshots](#screenshots)).

## The problem

Onboarding work spans HR, IT, hiring managers, Finance / Payroll, Facilities and the new employee. Responsibilities, hand-offs and deadlines are often spread across emails, spreadsheets and separate checklists, and the new hire sees little of it.

Completion percentages also hide what matters. A case can be 80% complete and still not ready for Day 1, because the missing task is mandatory, blocked, or a prerequisite for other work.

The project explores how onboarding could be coordinated as one process: transparent readiness rules for HR, a clear and private experience for the employee, and feedback that leads to agreed, tracked actions.

## Features

All features below are implemented and covered by the automated checks described under [Tests](#tests).

### Demo Mode
- An always-visible bar with **Preview as New Hire** (default) and **Preview as HR**. In the New Hire preview, a **Viewing as** picker chooses which fictional employee to preview; HR can also open the portal for a specific case.
- Pages from the other preview show a notice with a switch button instead of the page.
- **Reset demo data** restores the synthetic cases, learning progress and feedback (with confirmation).
- The previews are a simulation, not authentication or access control (see [Demo Mode limitations](#demo-mode-limitations)).

### Employee Portal
- **Home** (`/`, New Hire preview): a welcome that adapts to before the start, the first day, the following weeks and after Day 90; progress; the next Day 1/30/60/90 checkpoint; a five-phase journey strip; *This week* (own steps with *Mark as done*, team steps read-only); the manager, HR partner and buddy; the schedule; and what information is and is not shared.
- **Journey** (`/me/journey`): every step of the first 90 days by phase, in employee-facing wording, with an *All steps / Just mine* filter.
- A new hire can update only their own steps. Steps of other teams that are blocked or overdue show as *Delayed: HR is following up*; internal blocker reasons are never shown.
- Readiness is an HR classification and is not shown in the portal.

### Learning Center
- **Learning Center** (`/me/learning`): five short modules written for this demo (Company Culture & Values, Data Protection Essentials, Workplace Health & Safety, Remote Working Essentials, Leading Your New Team), grouped by Day 7 / 30 / 60 / 90 with mandatory or optional status, due date, status and the reason it was assigned.
- **Module viewer** (`/me/learning/[moduleId]`): one lesson at a time with *Mark as read*, then a quiz that unlocks after every lesson is read. Immediate feedback with explanations, a pass mark per module, unlimited retries and the attempt history.
- **HR learning overview** (`/learning`): mandatory completion, overdue, in progress and completed, with an overdue list and tables by employee and by module. The case page shows each employee's learning progress read-only.
- Every learning view states **"Illustrative content — not certified compliance training"**. Learning is reported separately and is not a readiness rule.

### Feedback & Check-ins
- **Pulse surveys** (`/me/feedback`, `/me/feedback/survey/[checkpoint]`) at Day 7, 30, 60 and 90: five statements rated 1–5 (role clarity, learning and development, manager support, team integration, tools and resources) and an optional comment. Each survey is open for 14 days from its checkpoint and can be submitted once.
- **Suggested discussion topics:** an area rated 2 or below suggests a topic that stays private until the employee chooses *Share for discussion* or *Keep private*. This is not a performance warning or risk rating; it changes no status and creates no action.
- **HR check-ins overview** (`/check-ins`): participation, upcoming and completed check-ins, approved topics (title and the employee's own note only), open and overdue actions, and meeting records.
- On the case page, raw ratings and comments are hidden behind *Show confidential answers*.

### Scheduling and Action Plans
- **Booking** (`/me/feedback/book`): an HR check-in, a manager check-in or a buddy chat in a fictional free slot (weekdays, next 14 days), with a draft agenda built from the check-in type, the next milestone, shared topics and the employee's own points. A booked slot is not offered again for the same host; booked check-ins appear in the portal schedule with their time.
- **Check-in page** (`/me/feedback/meetings/[id]`) and **meeting record** (`/check-ins/[id]`): participants, agenda, adding points, cancelling, the agreed outcome (shared) and an optional HR-only note (confidential).
- **Action plans:** actions are created only from a completed check-in or a topic the employee shared, with owner, due date, status, history and an optional link to an existing onboarding task (tasks are linked, not duplicated). After completion the employee answers *Yes, it helped*, *Partly* or *No, it did not help*; after "did not help" the action can be reopened with a new due date and its history is kept.

### HR Process Intelligence and Reporting
- **Dashboard** (`/`, HR preview): active onboardings per readiness status, upcoming starts, overdue and blocked tasks, overall task completion, critical outstanding tasks, a cases table, and four tiles linking to the Experience report.
- **Readiness & risk** (`/readiness`): per-case readiness cards with the milestone and reasons, critical tasks, and chains of blocked downstream work.
- **Case detail** (`/onboarding/[id]`): readiness panel with every reason and a 7-rule checklist, milestone tracker, stage timeline with dependency chips and blocker reasons, filters and status changes, plus learning and feedback sections.
- **Process insights** (`/insights`): Day 1 readiness, readiness mix, completion by stage, overdue tasks by owner, handover delays, recurring blockers and task distribution, as accessible bar charts with a table view.
- **Experience & Process Intelligence** (`/experience`): one report in five sections: executive overview, employee experience, learning & development, check-ins & actions, and process bottlenecks. Summary sections also appear on Process insights and Readiness & risk.
- **Create onboarding** (`/onboarding/new`) generates an adaptive workflow for office, remote, people-manager and international-hire contexts, with a live preview. **All tasks** (`/tasks`) lists every task with search and filters.
- Every analytics section states: *Calculated from synthetic demonstration data. Illustrative only — not validated business performance results.*

## Methodology

### Readiness

Each active case is assessed against its **next milestone** (Day 1, 30, 60 or 90) using fixed, ordered rules on **mandatory** tasks only. There is no weighted score. A completed task counts only when its mandatory prerequisites are also completed.

| Status | When |
|---|---|
| **Not ready** | A mandatory task is overdue or blocked, or a milestone is due (today or earlier) with mandatory work open |
| **At risk** | No critical issue, but required mandatory work is due within 7 days, waits on an open prerequisite, or was completed before its prerequisite |
| **On track** | No issue above; required work is open but nothing is due within 7 days |
| **Ready** | Every mandatory task required for the next milestone, including prerequisites, is completed |

### Adaptive workflows

| Context | Tasks | Mandatory |
|---|---:|---:|
| Office employee | 18 | 15 |
| Remote employee | 19 | 16 |
| + People manager | +4 | +3 |
| + International hire | +3 (HR review only) | +2 |

The international-hire module adds HR review and coordination tasks only. It makes or records no legal, immigration or eligibility decision, and no task approves compliance.

### Learning paths

Everyone: Culture & Values and Health & Safety (mandatory, Day 7), Data Protection (mandatory, Day 30). Remote employees: Remote Working (mandatory, Day 30); office and hybrid: Remote Working (optional, Day 90). People managers: Leading Your New Team (mandatory, Day 60). A module is complete when every lesson is read and, where there is a quiz, one attempt reaches the pass mark. Only the employee can record their own learning.

Full rules: **[docs/METHODOLOGY.md](./docs/METHODOLOGY.md)**.

## KPI definitions

Every KPI is calculated live from the data in the browser and shown with its definition. A zero denominator is shown as **No data**, never as 0%, NaN or Infinity.

| KPI | Formula | Excluded / notes |
|---|---|---|
| Onboarding readiness | Active onboardings that are *Ready* or *On track* ÷ all active onboardings | Completed onboardings. Existing readiness rules, unchanged. |
| Mandatory learning completion | Completed mandatory assignments due on or before today ÷ all mandatory assignments due on or before today | Optional modules; assignments due after today. |
| Check-in completion | Completed check-ins with an agreed outcome ÷ all non-cancelled check-ins dated on or before today | Upcoming and cancelled check-ins. |
| Feedback participation | Submitted surveys ÷ eligible surveys whose checkpoint date is on or before today | Future surveys. Expired, unanswered surveys stay in the denominator. |
| Action closure rate | Completed actions ÷ all actions in the reporting cohort | Open, in-progress and reopened actions count as not completed. |
| Overdue actions | Open or in-progress actions with a due date strictly before today | Actions due today; completed actions. |
| Experience trends | Average rating (1–5) per area and checkpoint from submitted surveys | Groups with fewer than five distinct employees are not shown. |
| Area averages | Each employee's average for the area across checkpoints, then averaged across employees | Same five-employee rule; each employee counts once. |
| Day 1 readiness rate | Started cases where every mandatory pre-boarding and Day 1 task was completed by the start date ÷ started cases | Cases not yet started. |

Bottlenecks (overdue tasks by owner, overdue mandatory learning by module, check-ins due but not booked, recurring unresolved actions, delays across stages) are descriptive counts with their definitions. They show where to look, not why something happened; figures that occur together are not presented as causes.

The remaining process KPIs (completion by stage, handover delays, recurring blockers, task distribution) are defined in [docs/METHODOLOGY.md](./docs/METHODOLOGY.md).

## Privacy safeguards

| Confidential | Shared |
|---|---|
| Raw survey ratings | Topics the employee chose to share (title and their own note) |
| Optional survey comments | Check-in agendas |
| Suggested topics not (yet) shared | Agreed meeting outcomes |
| HR-only meeting notes | Agreed actions and follow-up answers |

- **Consent before sharing:** suggested topics reach HR and agendas only after the employee shares them. Draft agendas never use ratings or comments.
- **No raw feedback in reporting:** the reporting layer never reads comments, individual ratings or HR-only notes. HR sees raw answers only on an individual case page after pressing *Show confidential answers*. There is no manager view.
- **Five-employee minimum:** an experience group (an area at a checkpoint, or an area across checkpoints) is shown only when at least **five distinct employees** contributed; submissions are not counted, people are. A smaller group is returned by the calculation without any value or count, so no chart, tooltip, table view or secondary table can show it. The report says which checkpoints are not shown and why.
- **No reconstruction through filters:** the reporting cohort is every case in the workspace, and the report has no filters, drill-downs or links from experience figures to individual cases.
- **Known limitation:** overlapping aggregates (for example the area averages and the Day 7 group, which contain largely the same people) can in principle be compared to narrow down a few answers. A production version would need complementary suppression, a higher minimum and a privacy review. The threshold of five is a demonstration minimum, not a validated standard.
- **Simulated, not enforced:** these rules are implemented in the interface and store actions, but Demo Mode has no sign-in and all data sits unencrypted in `localStorage`.

## Demo data

All names, roles, companies, ratings, comments and notes are **fictional and synthetic**. Do not enter real personal or employee information.

- **Ten fictional onboarding cases**, dated relative to today, covering every workflow module and readiness status. One of them, *Rafael Costa*, is a completed onboarding (Day 110).
- **Synthetic learning progress** and **synthetic feedback**: 12 survey responses from 5 fictional employees, four check-ins (three completed, one upcoming), one shared topic awaiting discussion, and three actions (one completed, one reopened, one overdue).
- **Experience trends:** the Day 7 group has five distinct fictional employees and is shown; Day 30, 60 and 90 have fewer and are not shown. When the default demo employee, Daniel Okafor, submits his open Day 7 survey, the Day 7 group grows to six.

With the demo data the headline figures are: readiness 3 of 8 active onboardings (38%), Day 1 readiness 4 of 6 started cases (67%), mandatory learning completion 14 of 16 (88%), check-in completion 3 of 3 (100%), feedback participation 12 of 14 (86%), action closure 1 of 3 (33%) and 1 overdue action. **These figures describe synthetic data only. They are illustrative and are not validated business performance results**; they imply no time or cost savings, productivity or retention effects.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript 5.9 · Tailwind CSS 4 · lucide-react · Vitest 5 with Testing Library and jsdom · ESLint 9 (`eslint-config-next`).

No backend, database, authentication, analytics, tracking or external API calls. No environment variables are required.

## Local installation

Requirements: Node.js 20.9 or newer (developed with Node 24) and npm.

```bash
git clone https://github.com/barbarajuhasz27-eng/hr-solutions-lab.git
cd hr-solutions-lab/smart-onboarding
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build
npm start            # http://localhost:3000
```

Quality checks:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest
```

Start in the **New Hire** preview to see the Employee Portal, or switch to **Preview as HR** in the Demo Mode bar for the HR workspace. *Reset demo data* in the navigation restores the original synthetic data.

## Project structure

```
app/                       Routes: /, /me/journey, /me/learning, /me/learning/[moduleId], /me/feedback,
                           /me/feedback/survey/[checkpoint], /me/feedback/book, /me/feedback/meetings/[id],
                           /readiness, /insights, /experience, /learning, /check-ins, /check-ins/[id],
                           /tasks, /onboarding/new, /onboarding/[id]
components/
  app-shell.tsx            Navigation per preview, Demo Mode bar, preview gate, reset action
  portal/                  Employee Portal home and journey
  learning/                Learning Center, module viewer, quiz, HR learning overview
  feedback/                Surveys, topics, booking, meeting records, action plans, HR check-ins
  experience/              Experience & Process Intelligence report and summaries
  dashboard/ readiness/    HR dashboard, readiness views, critical and blocked tasks
  insights/                Accessible bar list, process insights
  onboarding/ tasks/       Create form, case detail, timeline, task board
  ui/                      Buttons, cards, badges, form controls, dialog, toast
lib/
  readiness.ts             Rule-based readiness engine
  dependencies.ts          Prerequisites, blocked downstream work, cycle check
  workflow-templates.ts    Task library and adaptive workflow modules
  process-intelligence.ts  Process KPIs and definitions
  experience.ts            Experience KPIs, five-employee suppression, bottlenecks
  learning.ts, feedback.ts Learning and feedback rules
  portal.ts, access.ts     Employee-facing view, simulated preview permissions
  *-seed.ts, seed-data.ts  Synthetic demo data
  onboarding-store.ts      localStorage persistence, validation and migration
types/                     Domain types
tests/                     Unit and component tests
docs/                      Product brief, methodology, build specification, screenshot plan
```

## Tests

**332 tests across 27 files** (Vitest, Testing Library, jsdom). They cover:

- **Readiness, dependencies and workflows:** every status and rule, rule precedence, prerequisites and blocked downstream work, cycle detection, adaptive task sets, and a guard against decision or approval wording in the international module.
- **Employee Portal and Demo Mode:** employee wording without blocker notes, phases, the week plan, the task permission matrix, store enforcement and the preview gate.
- **Learning Center:** paths, due dates, quiz scoring and locks, completion and overdue rules, the mandatory completion formula, and a guard against certification claims.
- **Feedback, check-ins and action plans:** survey windows, the insight rule, consent, slot booking without double-booking, agendas without ratings or comments, HR-only notes stripped from shared views, actions, follow-ups and reopening.
- **Experience & Process Intelligence:** each KPI and its exclusions, zero denominators, employee-level averaging, the five-distinct-employee threshold (four hidden, five shown, many submissions from few people hidden), suppressed groups carrying no value or count, no comments, notes or names in the report, tooltips or table views, no filters, each bottleneck, and the dashboard, insights and readiness integrations.
- **Persistence:** seeding, validation, recovery and migration from earlier schema versions.
- **Components:** the main portal and HR pages rendered and used in jsdom.

## Screenshots

Screenshots have **not been captured yet**. The recommended list, capture settings and file names are in [docs/screenshots/README.md](./docs/screenshots/README.md). Screenshots must show only the fictional demo data.

## Demo Mode limitations

- **No authentication or access control.** The New Hire / HR switch is a preview. Anyone using the browser can switch previews and open any case; permission rules are demonstrated in the interface and store, not enforced.
- **Browser-only storage.** Data lives unencrypted in this browser's `localStorage`. It is not shared between browsers or devices; clearing site data removes it. There is no backend, retention policy or audit trail.
- **Generated scheduling.** Check-in slots are fictional, not real availability. There are no calendar invites, emails, notifications or reminders.
- **One person records outcomes.** Meeting outcomes and actions are recorded in the HR preview on behalf of all participants; there is no manager or buddy view.
- **Fixed content and rules.** Learning modules, survey questions, the 14-day survey window, the topic threshold of 2, readiness windows and the five-employee minimum are fixed in code and have not been validated with employees or HR practitioners.
- **Small synthetic dataset.** With ten demo cases, all figures are illustrative and not statistically meaningful. Only the Day 7 experience group reaches the five-employee minimum.

## Known limitations

- Only completion dates and a blocked counter are recorded, with no full status history; handover delays measure upstream lateness rather than waiting time.
- Tasks cannot be added, edited or re-assigned individually, and case details cannot be changed after creation.
- Reporting shows the current state only: one fixed cohort, no filters, no export, no historical snapshots and no benchmarks.
- No LMS, SCORM, HRIS, calendar, payroll or identity integration. Quiz answers are checked in the browser and lesson reading is self-reported.
- The learning modules are illustrative and are **not certified compliance training**. The prototype gives no legal, immigration, payroll or tax guidance and makes no eligibility decisions.

## Future opportunities (not implemented)

These are ideas only; none of them exists in the prototype.

- Real authentication and role-based access, including a manager view that never shows confidential feedback.
- A secure backend with retention rules, audit trail and encryption; HRIS, calendar and LMS integrations.
- Complementary suppression, privacy review and approved filters for experience reporting once groups are large enough.
- Historical snapshots to show change over time.
- Configurable readiness rules, survey questions and learning paths, validated with HR practitioners and employees.

## Documentation

- [Product brief](./docs/PRODUCT_BRIEF.md)
- [Readiness, dependency and KPI methodology](./docs/METHODOLOGY.md)
- [Original MVP build specification](./docs/BUILD_SPEC.md)
- [Screenshot plan](./docs/screenshots/README.md)
- [Claude implementation prompt](./CLAUDE_BUILD_PROMPT.md)

## Disclaimer

Smart Onboarding is an independent portfolio project created for demonstration and learning purposes. It uses only fictional, synthetic data and contains no confidential employer information or real employee data. It is not production software and is not legally validated.
