# Claude / Cursor Build Prompt — HR Operations Hub

Build the HR Operations Hub as a separate application inside the HR Solutions Lab repository at `hr-operations-hub/`.

Before coding, read:

- `README.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/PROCESS_MODEL.md`
- `docs/DATA_AND_PRIVACY.md`

This is an **HR Operations Readiness & Playbooks** prototype for HR Generalists and lean HR teams. It is not an employee ticket portal, generic project-management tool or Jira clone.

## Product outcome

A reviewer should understand this core promise:

**Create an HR activity from a reusable playbook, see what must happen before it starts, and get a practical recovery plan when time is running out.**

The lead scenario is a training session due to start in 45 minutes, with room, IT, trainer, participant and material tasks still outstanding.

## Product scope

Build four connected surfaces:

1. Operations Radar
2. Playbook Library
3. Activity Workspace
4. Rapid Recovery

A small post-activity review completes the learning loop.

## Visual direction

Use a restrained enterprise HR Operations aesthetic:

- precise, understated and operationally credible for a DACH enterprise HR function;
- readable typography and calm neutral surfaces;
- date-first calendar / timeline presentation;
- task dependency and readiness information that is immediately understandable;
- visible distinction between Essential, Important and Optional actions;
- responsive desktop and mobile layouts;
- avoid generic SaaS dashboards, huge KPI cards, decorative charts and excessive gradients.

The design should feel like an operational cockpit for a busy HR Generalist, not a ticketing system.

## Required surfaces and interactions

### 1. Operations Radar

- Calendar / timeline of upcoming activities.
- Sections for Today, Next 7 Days, At Risk and Overdue.
- Each activity shows activity type, date/time, coordinator, readiness state and next critical action.
- Quick-create from a playbook.
- Create recurring instances from a recurrence pattern.
- Filter by activity type, time and readiness.

### 2. Playbook Library

Seed at least five playbooks:
- Training session
- Employee information session
- Performance review cycle launch
- Recurring monthly HR deadline (generic; no payroll calculation)
- Policy / process communication

Each playbook has actions, relative lead times, default owner roles, criticality, estimated effort, dependencies and optional fallbacks. Allow the demo user to inspect and minimally edit a playbook.

### 3. Activity Workspace

- Activity date/time and coordinator.
- Generated action timeline.
- Owners and unassigned actions.
- Relative due time and overdue indicator.
- Dependency visualization / clear blocked-by explanation.
- Action statuses: Not started, In progress, Waiting, Done, Blocked, Skipped.
- Readiness explanation that names each unresolved Essential action.
- Duplicate activity or create another from the same playbook.

### 4. Rapid Recovery — essential feature

Provide a dedicated action when an activity is close to its start time and Essential actions remain unresolved.

It must:
- show time remaining;
- group actions into Must do now, Can simplify, Can follow up later and Blocked / needs someone else;
- respect dependencies;
- present practical fallback options defined by the playbook;
- let the HR Generalist record a decision and update action state;
- state why each action was prioritised;
- never claim to send messages, book rooms, configure IT or contact a person.

Use a seeded training activity with **45 minutes remaining** as the first-run demonstration. The scenario should be understandable without additional explanation.

### 5. Post-activity review

- Complete or cancel an activity.
- Record missed, simplified or fallback actions.
- Add one short process learning note.
- Let the user propose a playbook update for a later cycle.
- No individual ratings or performance scoring.

## Data and behavior

- Typed TypeScript models for Activity, Playbook, Action and recurrence.
- Seed 6–10 synthetic activities across upcoming, ready, at-risk, overdue and completed states.
- Seed 5 playbooks as above.
- Include one dramatic but realistic 45-minute training rescue case.
- Include a recurring HR deadline and a performance-review cycle launch.
- Calculate action due dates from activity start and relative lead times.
- Derive readiness deterministically from Essential actions, status, due time and dependency state.
- Recovery grouping must be deterministic and explained; do not use AI.
- A user action is required to mark an action done or skipped.
- Local browser storage only; no backend or external requests.
- Reset-to-demo-data must restore the exact seeded scenario.
- All people, organisations, event titles and activity notes must be fictional and non-sensitive.

## Explicit boundaries

Do NOT build:
- employee request intake;
- ticket queues or case-management lifecycle;
- generic to-do lists or Jira-like project boards;
- HRIS or LMS functionality;
- email, calendar, Teams, room-booking, payroll or IT integrations;
- automatic reminders or real notifications;
- authentication or production role permissions;
- file uploads or real employee data;
- payroll, legal or compliance decisions;
- AI triage or autonomous actions.

## Quality expectations

- TypeScript strictness and modular domain logic.
- Unit tests for due-date generation, recurrence, dependencies, readiness calculation and recovery grouping.
- Tests for late, blocked, skipped and fallback action paths.
- Verify that the 45-minute training case produces a coherent, explainable recovery plan.
- Include empty states, invalid input handling, accessibility and mobile layouts.
- Do not claim business impact without user testing.

## Suggested build sequence

1. Inspect repository conventions and create the isolated application skeleton.
2. Implement domain types, five playbooks, synthetic activities and deterministic date / dependency logic.
3. Build Operations Radar and Playbook Library.
4. Build Activity Workspace and readiness explanation.
5. Build Rapid Recovery and the 45-minute training scenario.
6. Add post-activity review, responsive polish and automated tests.
7. Update project documentation and add authentic screenshots only after capture.

Before finishing, report changed files, implemented features, test results, typecheck/build results and limitations honestly. Do not mark any feature complete unless implementation and tests support it.
