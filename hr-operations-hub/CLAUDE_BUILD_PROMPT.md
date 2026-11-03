# Claude / Cursor Build Prompt — HR Operations Hub

Build the HR Operations Hub as a separate application inside the HR Solutions Lab repository at `hr-operations-hub/`.

Before coding, read:

- `README.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/PROCESS_MODEL.md`
- `docs/DATA_AND_PRIVACY.md`

The project is an Employee Services & HR Case Management prototype. It is **not** another onboarding application. Smart Onboarding already covers offer acceptance through the first 90 days. The Hub covers ongoing HR service requests and case resolution.

## Product outcome

Deliver a polished, credible portfolio prototype with three connected surfaces:

1. Employee Portal
2. HR Service Desk
3. Operations Insights

A reviewer must be able to follow one case from employee submission through triage, assignment, internal processing, employee update, resolution and closure.

## Visual direction

Use a restrained enterprise HR operations aesthetic:

- clear information hierarchy and readable typography;
- calm neutral surfaces with one restrained accent colour;
- compact but comfortable tables and queue rows;
- status labels with text as well as colour;
- strong distinction between employee-facing and HR-only information;
- responsive desktop and mobile layouts;
- avoid a generic SaaS template look, excessive cards, gradients and decorative charts.

The design should feel suitable for an Austrian or DACH enterprise HR function: precise, understated and operationally credible.

## Required application features

### Shared shell and navigation

- App name: HR Operations Hub.
- Persistent navigation with Employee Portal, HR Service Desk and Operations Insights.
- A clear Demo Mode indicator.
- A role/view selector labelled as a simulated preview, not a login or security feature.
- A Reset demo data action with confirmation.

### Employee Portal

- Overview of a small number of synthetic requests.
- New request form with a controlled service category and topic.
- Dynamic fields based on the selected topic; do not ask for sensitive personal details.
- Submit creates a case with a reference number.
- My Requests list with status, last updated time and reference.
- Case detail timeline with employee-visible messages only.
- Employee reply action when the case is Waiting for employee.
- Visible reminder not to enter health, bank, tax, identity-document or other sensitive information.

### HR Service Desk

- Queue summary: open, unassigned, waiting for employee, waiting for another team, overdue.
- Search and filters for status, category, queue, owner, priority and date/age.
- Case detail with employee request, triage fields, service targets, activity and next action.
- Assign queue and owner.
- Change status through the defined lifecycle.
- Request information from employee.
- Add an internal note that never appears in employee view.
- Send employee-visible updates as a separate action.
- Resolve and close cases; allow reopening.
- Show the illustrative SLA due date and explicitly label it as a demo target, not company policy.

### Operations Insights

- Incoming volume by category.
- Open backlog by queue and status.
- Overdue cases and unassigned cases.
- Median resolution time for resolved requests.
- Reopened rate with denominator and cohort definition.
- Waiting-state breakdown.
- Every metric must have a written definition, date range, population and synthetic-data disclaimer.
- No composite score, employee ranking or team blame.

## Data and behaviour

- Use typed TypeScript models.
- Seed at least 12–16 fictional cases across all major categories, queues, statuses and priorities.
- Include useful edge cases: unassigned case, waiting for employee, waiting for another team, overdue, resolved, reopened.
- Use deterministic category-to-queue mapping which HR can override.
- Use local browser storage only; no backend or external requests.
- All seeded people and requests must be fictional and non-sensitive.
- Do not include actual employer policies, legal advice or payroll calculations.
- The Employee/HR view switch is only a simulated preview. Do not imply real access control.
- Ensure internal notes are filtered out of the employee-facing view in application logic, not merely hidden with CSS.

## Quality expectations

- TypeScript strictness, component separation and accessible controls.
- Unit tests for status transitions, queue mapping, SLA state, KPI calculations and employee/internal activity visibility.
- Tests for request submission, assignment, waiting-state transitions, resolution and reopening.
- Include reset-to-demo-data.
- Handle empty states and invalid form states.
- Avoid fake live notifications or integrations.

## Suggested build sequence

1. Inspect repository conventions and create the isolated app skeleton.
2. Implement domain types, synthetic data, workflow transitions and KPI calculations.
3. Implement Employee Portal request submission and tracking.
4. Implement HR Service Desk queue and case workspace.
5. Implement Operations Insights.
6. Add responsive polish, accessibility and automated tests.
7. Update README and screenshots plan with what actually exists.

## Explicit non-goals

No authentication, no production permissions, no backend, no email/Teams/HRIS/payroll integrations, no file uploads, no real employee data, no AI triage, no legal or payroll decisions, no production SLA claims.

Do not mark any feature complete until the implementation and tests support that claim. Before finishing, report changed files, features implemented, test results, typecheck/build results and all limitations honestly.
