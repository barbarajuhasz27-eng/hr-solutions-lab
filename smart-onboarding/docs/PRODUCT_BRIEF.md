# Smart Onboarding — Product Brief

## 1. Product summary

Smart Onboarding is an **Onboarding Readiness & Process Intelligence** prototype for HR / People Operations.

> Move beyond task completion. Understand whether employees are truly ready to start, identify cross-functional process risks and continuously improve onboarding operations.

It helps an HR coordinator oversee onboarding from offer acceptance through the first 90 days. Beyond tracking tasks, it assesses each employee's readiness for their next milestone with transparent rules, makes cross-team dependencies and blockers visible, and aggregates process patterns across cases.

The MVP is a browser-based portfolio prototype using fictional employees and synthetic data. It has since been extended into an Employee Experience platform in four phases (see section 12); all four are implemented and still run locally on synthetic data without sign-in.

## 2. Problem statement

Onboarding requires coordinated work across HR, IT, hiring managers, Finance / Payroll, Facilities and the new employee. In fragmented processes, tasks are often tracked in emails or spreadsheets. This can lead to unclear ownership, missed deadlines and limited visibility into readiness for Day 1.

Task completion percentages alone do not answer the questions HR is actually asked: *Is this person ready to start on Monday? What is holding them up? Which team handovers keep slipping?* A case can be 80% complete and still not ready, because the one missing task is mandatory, blocked, or a prerequisite for something else.

## 3. Differentiation

Smart Onboarding explores a readiness-first approach to onboarding coordination. Its distinguishing design choices within this prototype are:

1. **Readiness instead of completion.** Each case is assessed against its next milestone (Day 1, 30, 60 or 90) using explicit rules on mandatory tasks, deadlines, blockers and dependencies.
2. **Explainability.** Every status comes with the exact failing rules and the tasks behind them. There are no weighted scores.
3. **Dependency-aware workflows.** Tasks declare prerequisites, so blocked downstream work and cross-team handovers become visible.
4. **Process intelligence.** Aggregate KPIs — Day 1 readiness rate, handover delays, recurring blockers, workload by stakeholder — turn individual cases into process-improvement signals.
5. **Adaptive templates.** Office, remote, people-manager and international-hire contexts generate different workflows from one task library.

General-purpose work-management tools and HR platforms can also model tasks, dependencies and reporting. This project does not claim to be unique or superior to them; it is a focused exploration of how onboarding-specific readiness logic could be designed and explained.

## 4. Target users and stakeholders

**Primary user**
- HR / People Operations coordinator: creates onboarding cases, monitors readiness, assigns and updates tasks, follows up on blockers and reviews process insights.

**Stakeholders represented in the workflow**
- IT: equipment, accounts and system access
- Hiring manager: role-specific plan, team introductions and check-ins
- Finance / Payroll: payroll setup requirements
- Facilities / Office: desk, badge and workplace access
- New employee: onboarding forms, first 1:1s (managers) and experience feedback

The MVP does not implement separate logins or permissions for these stakeholders. They are represented as task owners in a single HR demo workspace.

## 5. Product goals

1. Show, for every case, whether the employee is ready for the next milestone — and why.
2. Make task ownership, mandatory requirements, due dates, dependencies and status visible.
3. Surface blockers and the downstream work they hold up before they affect Day 1.
4. Generate consistent, context-appropriate workflows through adaptive templates.
5. Reveal recurring cross-functional process issues through aggregate, clearly defined KPIs.
6. Demonstrate process thinking through a usable, tested product prototype.

## 6. Non-goals for the MVP

- Production use or storage of real employee records
- Authentication, role-based access control or multi-tenant support
- Email, calendar, payroll, identity-management or HRIS integrations
- Electronic signatures or contract generation
- Automated legal, immigration or employment-eligibility decisions, or compliance approvals
- Weighted or AI-generated readiness scores, or AI-generated employee assessments
- Native mobile application
- Claims about time savings, productivity or improved retention without actual validation

## 7. Core user journey

1. HR opens the dashboard and sees how many active onboardings are Not ready, At risk, On track or Ready.
2. HR opens the critical outstanding tasks and the Readiness & risk overview to see what is blocking whom.
3. HR creates an onboarding case, choosing the work arrangement and whether the hire is a people manager or an international hire.
4. The system generates the matching workflow with mandatory/optional tasks, dependencies and due dates relative to the start date.
5. HR opens the employee's case and reads the readiness explanation, rule checklist and dependency chains.
6. HR updates task statuses; readiness, milestones and dashboards update immediately.
7. HR reviews the Process insights page to spot recurring blockers, delayed handovers and overloaded teams.

## 8. Success criteria for the prototype

The MVP is successful when a reviewer can:
- Understand the purpose of the product without explanation.
- See which employees are not ready for their next milestone, and the exact reasons.
- Trace a blocked task to the downstream tasks it holds up.
- Create a new onboarding case in under a minute and see a context-appropriate workflow.
- Update a task and see readiness change on the case, the dashboard and the overviews.
- Read every process KPI together with its definition.
- Reset the application to its original synthetic demo state.

These are usability goals for the prototype, not measured business outcomes.

## 9. Privacy and responsible use

All demo data must be synthetic. The application clearly states that it is a demonstration prototype and must not be used to store real employee information. Process insights and the Experience & Process Intelligence report are labelled as illustrative results from synthetic data. Survey comments, individual ratings and HR-only notes never appear in aggregate reporting, and experience ratings are shown only for groups of at least five distinct employees. No analytics, tracking, external API calls or third-party data transfers are used.

## 10. Methodology

The readiness rules, dependency logic, adaptive workflow modules, process KPIs and the Experience & Process Intelligence KPIs and suppression rules are documented in [METHODOLOGY.md](./METHODOLOGY.md).

## 11. Future opportunities (not implemented, not commitments)

- Full status history (start times, blocked durations) for more precise handover and blocker metrics
- Separate stakeholder views and notifications for task owners
- Configurable templates and readiness windows per organisation
- HRIS and calendar integrations
- Accessibility and localisation improvements
- Persistence through a secure backend with access controls and retention policies
- A manager view that never shows confidential feedback, backed by real role-based access
- Complementary suppression, privacy review and approved filters for experience reporting once groups are large enough
- Historical snapshots so reporting can show change over time, not only the current state

## 12. Employee Experience evolution (implemented)

| Phase | Implemented functionality |
|---|---|
| 1. Employee Portal and Demo Mode | A personal portal for the new hire (home, journey, contacts, schedule) and a simulated New Hire / HR preview switch. The switch is a preview, not authentication or access control. |
| 2. Learning Center | Five illustrative modules with lessons and quizzes, learning paths per checkpoint, mandatory and optional assignments, and an HR learning overview. Learning is reported separately and is not a readiness rule; the modules are not certified compliance training. |
| 3. Feedback, check-ins and action plans | Day 7/30/60/90 pulse surveys, employee-controlled sharing of discussion topics, check-in booking with fictional slots, meeting records with an HR-only note, and action plans with follow-up and reopening. Confidential and shared information are kept apart. |
| 4. Experience & Process Intelligence | An HR-only report (`/experience`) with an executive overview, employee experience (with five-employee suppression and no filters), learning, check-ins and actions, and process bottlenecks, plus dashboard tiles and summary sections on the insights and readiness pages. Every KPI has a visible definition and every section states that it is illustrative. |

The success criteria in section 8 still apply. In addition, a reviewer should be able to read every Experience KPI with its formula and see that small experience groups are not shown. These remain usability goals; no user testing has been conducted and no business outcome is claimed.
