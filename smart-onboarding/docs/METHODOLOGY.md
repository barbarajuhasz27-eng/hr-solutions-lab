# Smart Onboarding — Readiness, Dependency and Process-Intelligence Methodology

This document explains exactly how Smart Onboarding decides readiness, resolves task dependencies, composes adaptive workflows and calculates process KPIs. The rules are implemented in `lib/readiness.ts`, `lib/dependencies.ts`, `lib/workflow-templates.ts`, `lib/process-intelligence.ts` and `lib/experience.ts`, and every rule below is covered by automated tests in `tests/`.

All data in the prototype is synthetic. The methodology describes how the prototype behaves; it has not been validated with real organisations or users.

---

## 1. Task model

Every task carries:

| Attribute | Meaning |
|---|---|
| Owner | The team responsible: HR, IT, Finance / Payroll, Facilities, Hiring manager, HR + Hiring manager or New employee |
| Stage | Pre-boarding, Day 1, First 30 days, Day 60 or Day 90 |
| Due date | Calculated from the start date using the template's day offset |
| Status | Not started, In progress, Completed or Blocked |
| Mandatory / optional | Only mandatory tasks gate milestones and readiness |
| Dependencies | Prerequisite tasks in the same case (by template key) |
| Blocked count / reason | How often the task has been moved into Blocked, and an optional reason |

## 2. Dependency rules

- A dependency points from a task to its **prerequisite** in the same case.
- Only **mandatory** prerequisites hold a task up. An optional prerequisite is shown for context but never affects readiness.
- A task is **effectively complete** only when it is marked Completed **and** all of its mandatory prerequisites — transitively — are completed. A task marked completed before its prerequisite does not count towards readiness and is flagged.
- Dependency state of an open task:
  - **Resolved** — every mandatory prerequisite is effectively complete.
  - **Waiting** — at least one mandatory prerequisite is still open.
  - **Held up (blocked upstream)** — a mandatory prerequisite anywhere upstream is Blocked or overdue.
- **Blocked downstream tasks** are open tasks held up by an upstream mandatory task that is Blocked or overdue. They are listed against the nearest problematic prerequisite.
- Templates are checked in tests for cycles, for references to tasks that exist in each generated workflow, and for prerequisites never being scheduled after their dependants.

Examples from the default library:

- *Set up system and application access* depends on *Provision user account*.
- *Confirm equipment and system access* (Day 1) depends on *Prepare laptop and equipment* and *Set up system and application access*, so IT equipment readiness is required before the Day 1 milestone.
- *Confirm payroll setup requirements* (Finance) depends on the new employee completing *new-hire onboarding forms* — a cross-team handover.

## 3. Milestones

| Milestone | Date | Gated by mandatory tasks in |
|---|---|---|
| Day 1 | Start date | Pre-boarding and Day 1 |
| Day 30 | Start + 30 days | First 30 days |
| Day 60 | Start + 60 days | Day 60 |
| Day 90 | Start + 90 days | Day 90 |

A milestone is **reached** when every mandatory task in its stages is effectively complete. Optional tasks never gate a milestone.

The **next milestone** is the first milestone dated today or later. Missed earlier milestones remain visible as *Overdue* and are covered by the readiness rules. After Day 90 has passed, the next milestone is the first one not reached, or none when all are reached.

## 4. Readiness assessment

Readiness answers one question: *is this employee ready for their next milestone, and if not, why?* It uses fixed, ordered rules — **no weighted scores and no hidden weighting**.

The **required tasks** for an assessment are the mandatory tasks in the next milestone's stages plus all of their mandatory prerequisites (from any stage).

| # | Rule | If it fails |
|---|---|---|
| 1 | No mandatory task is overdue (any stage) | **Not ready** |
| 2 | No mandatory task is blocked (any stage) | **Not ready** |
| 3 | No milestone is due (today or earlier) while its mandatory tasks are open | **Not ready** |
| 4 | No open required task is due within 7 days | **At risk** |
| 5 | No required task that is due within 7 days or in progress is waiting on an open mandatory prerequisite | **At risk** |
| 6 | No task is marked completed before its mandatory prerequisite | **At risk** |
| 7 | All required tasks for the next milestone are completed | **On track** |

The status is set by the first group that has a failing rule:

- **Not ready** — any of rules 1–3 fails.
- **At risk** — rules 1–3 pass, any of rules 4–6 fails.
- **On track** — rules 1–6 pass, rule 7 fails: required work is open, but nothing is due within 7 days and nothing is waiting on a problem.
- **Ready** — every rule passes: all mandatory tasks required for the next milestone are completed. A case whose milestones are all reached is also Ready.

**Why "On track" exists.** The three statuses in the original brief (Ready, At risk, Not ready) do not cover a case whose next milestone is weeks away and where nothing is wrong yet. Labelling that case *Ready* would overstate progress, and labelling it *At risk* would create false alarms. *On track* is a neutral fourth state for exactly that situation.

**Transparency.** Each assessment returns:

- the status and a one-line headline,
- the milestone it was assessed against, with the required-task count,
- every failing rule, as a plain-language reason naming the task, owner, due date and — for blockers — the downstream tasks it holds up,
- the full rule checklist with pass/fail for each rule.

The employee detail page shows all of this; the Readiness & risk page summarises it per case.

### Critical outstanding tasks

Across all cases, an open **mandatory** task is listed as:

- **Critical** when it is overdue, blocked, or held up by a blocked/overdue upstream prerequisite;
- **Warning** when it is due within 7 days (with a note if it is still waiting on a prerequisite).

## 5. Adaptive workflows

Each case receives the **core** module plus modules chosen from its onboarding context.

| Module | Applied when | Adds |
|---|---|---|
| Core | Always | Documentation, new-hire forms, payroll setup, account provisioning, equipment, system access, first-week agenda, onboarding buddy (optional), Day 1 orientation, team introduction, access confirmation, 30/60/90-day check-ins, experience feedback (optional) |
| Office employee | Work arrangement = Office | Desk and building access; office walkthrough (optional) |
| Remote employee | Work arrangement = Remote | Equipment delivery, remote IT setup call, remote-working guidelines (optional) |
| People manager | Context option | Team handover briefing, manager system permissions, first 1:1s with direct reports, manager development resources (optional) |
| International hire | Context option | **HR review tasks only**: HR review of the international hire context, follow-up of open review questions, arrival information (optional) |

Dependencies that point to tasks outside the selected modules are dropped, so every generated workflow is self-consistent.

**Guardrail for international hires.** The international module only adds HR review and coordination tasks. It does not make, record or automate legal, immigration or employment-eligibility decisions, and no task approves compliance. Questions are routed to qualified specialists outside the tool. A test checks the task library for decision or approval wording.

## 6. Process-intelligence KPIs

The Process insights page aggregates the cases in the browser. In this prototype those are synthetic demo cases, so **every figure is illustrative**. The KPIs describe the dataset only; no savings, productivity or retention effects are inferred.

| KPI | Definition |
|---|---|
| Day 1 readiness rate | Of cases whose start date is today or earlier: the share where every mandatory pre-boarding and Day 1 task was completed on or before the start date, with its mandatory prerequisites also completed. |
| Readiness of active cases | Current readiness status of each active (not fully completed) case. |
| Completion by stage | For each stage, the share of tasks already due (due today or earlier) that are completed. Not-yet-due tasks are excluded so later stages are not shown as behind. |
| Overdue tasks by owner | Open tasks past their due date, grouped by owning team; overdue share = overdue ÷ open tasks for that owner. |
| Handover delays | A handover is a dependency where the prerequisite and dependent task have different owners. It is delayed when the prerequisite was completed after its due date, or is still open and overdue. Delay = days past the prerequisite's due date. Only handovers whose prerequisite is already due are counted. |
| Recurring blockers | Task types (same template) blocked at least once — now or earlier, via the blocked count — in two or more cases. |
| Task distribution | Tasks per owner across all cases, with share of total and open count. |

Known measurement limits: the prototype records completion dates but not start dates or full status history, so handover delays measure upstream lateness rather than true waiting time, and blocked history is a count rather than durations.

## 7. Experience & Process Intelligence

The `/experience` report (HR preview) combines onboarding, readiness, learning, surveys, check-ins and actions. It is calculated live from the data in the browser — synthetic in this prototype — and every section states: *Calculated from synthetic demonstration data. Illustrative only — not validated business performance results.*

**Reporting cohort.** Every onboarding case in the workspace. There are no filters (department, manager, location, date), by design: see small-group suppression below.

**No-data rule.** Every rate keeps its numerator and denominator. A zero denominator gives *No data*, never 0%, NaN or Infinity.

### KPI formulas

| KPI | Formula | Excluded |
|---|---|---|
| Onboarding readiness | Active onboardings with status *Ready* or *On track* ÷ all active onboardings | Completed onboardings. The readiness rules in section 4 are unchanged; learning is not part of them. |
| Mandatory learning completion | Completed mandatory assignments due on or before today ÷ all mandatory assignments due on or before today | Optional modules; mandatory assignments due after today. |
| Check-in completion | Completed check-ins with an agreed outcome ÷ all non-cancelled check-ins dated on or before today | Upcoming and cancelled check-ins. A past check-in without an outcome counts as not completed. |
| Feedback participation | Submitted surveys ÷ eligible surveys whose checkpoint date (start date + 7, 30, 60 or 90 days) is on or before today | Future surveys. Expired, unanswered surveys stay in the denominator. |
| Action closure rate | Completed actions ÷ all actions in the reporting cohort | Nothing; open, in-progress and reopened actions count as not completed. |
| Overdue actions | Count of actions that are Open or In progress with a due date strictly before today | Completed actions and actions due today. |
| Experience trend | Mean rating (1–5) per area and checkpoint from submitted surveys | Groups with fewer than five distinct employees. |
| Area average | Mean of each employee's mean rating for the area across checkpoints | Groups with fewer than five distinct employees. Each employee counts once. |

Supporting figures: participation by checkpoint (submitted and eligible counts), mandatory completion and overdue mandatory assignments by module, learning status by checkpoint (Completed, Overdue, In progress, Not started — one status per assignment), and check-ins upcoming, completed, cancelled and awaiting an outcome.

### Small-group suppression

1. An experience group is reported only when **at least five distinct employees** contributed. Submissions are not counted; people are.
2. A suppressed group is returned by `getExperienceTrends` as `{ shown: false }` — with no average and no count — so no chart, tooltip, table view or secondary table can display it.
3. Charts include shown groups only; tooltips and table views repeat the same aggregated values.
4. The report has no filters or drill-downs, and the experience section does not link to individual cases.
5. Comments, individual ratings and HR-only notes are never read by the reporting layer.
6. The report marks each hidden cell as *Not shown* and names the hidden checkpoints with the reason (fewer than five different employees), without any count or value.

**Demo data.** The synthetic seed has 12 survey responses from five fictional employees. The Day 7 group (five employees) and the area averages are shown; Day 30, 60 and 90 are not.

**Limitation.** Overlapping aggregates (for example the overall area average and the Day 7 group, which can contain largely the same people) can in principle be compared to narrow down a few answers. A production version would need complementary suppression, a higher minimum and a privacy review. The threshold of five is a demonstration minimum, not a validated standard.

### Bottlenecks

| Bottleneck | Rule |
|---|---|
| Overdue tasks by owner | Open onboarding tasks past their due date, grouped by owning team, most overdue first. |
| Overdue mandatory learning by module | Mandatory assignments not completed and past their due date. |
| Check-ins due but not booked | Active onboarding where (a) a shared topic awaits discussion and no check-in is scheduled, or (b) the Day 30 checkpoint has passed, the case is at most 90 days in, and no non-cancelled check-in exists. |
| Recurring unresolved actions | Actions with a reopen count of at least one that are not completed. |
| Delays across stages | Overdue tasks per stage, beside the share of already-due tasks completed (section 6). |

Each bottleneck is shown with its definition, what it means and the process area that may need attention. They are descriptive counts of the current state: they do not establish causes, and figures that occur together are not presented as one causing the other.
