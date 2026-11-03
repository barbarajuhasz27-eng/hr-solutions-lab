# HR Operations Hub
### HR Operations Readiness & Playbooks

**Project status:** In development · first functional slice plus readiness improvements implemented; local checks pass (51 tests, typecheck, lint and production build)  
**Target user:** HR Generalists and lean HR teams  
**Domain:** HR Operations · Operational Readiness · Workflow Coordination  
**Portfolio:** HR Solutions Lab

HR Operations Hub is a focused workspace that helps HR Generalists keep important recurring and one-off operational activities from slipping through the cracks.

Instead of another employee ticket queue, the Hub starts with an **HR activity or event** — for example a training session, an employee information event, a performance-cycle launch or a recurring HR deadline. A reusable playbook turns that activity into a timed sequence of actions, owners, dependencies and readiness checks.

> Keep HR operations from slipping through the cracks.

## The product hypothesis / USP

**Time-aware HR playbooks with a rapid-recovery mode.**

The prototype explores two connected capabilities:

1. **Prepare:** create an HR activity from a reusable playbook, set its date and owners, and generate the actions that need to happen before it starts.
2. **Recover:** when the activity is at risk or already running late, show the remaining critical actions in priority order, the dependencies and practical fallback options.

The central question is not “How many tasks are complete?” but:

**“What must still happen for this HR activity to run successfully — and what should I do first?”**

## MVP surfaces

1. **Operations Radar** — a calendar and overview of upcoming, at-risk and overdue HR activities.
2. **Playbook Library** — reusable HR-specific checklists with lead times, dependencies, owners and criticality.
3. **Activity Workspace** — the operational view for one event or process instance, including readiness and assigned actions.
4. **Rapid Recovery** — a time-aware view for late starts, such as the 45-minute training scenario.

## Lead use case: the 45-minute training rescue

A training session is due to start in 45 minutes. The HR Generalist opens the activity and sees the remaining essentials: confirm the trainer, notify participants, secure a room, check IT / presentation equipment and prepare materials. Actions are grouped by urgency and dependency. If a normal preparation step can no longer be completed, the playbook shows a practical fallback rather than merely marking it overdue.

The prototype does not book rooms, send real messages or configure IT. It helps the HR Generalist understand and coordinate what needs to happen.

## What this is not

- Not Jira, ServiceNow or a generic ticket-management clone.
- Not an employee request portal or HR case-management queue.
- Not a full project-management application.
- Not an HRIS, LMS, calendar or email replacement.
- Not an AI assistant that independently decides priorities or contacts employees.
- Not a production system for real employee data.

## Project documentation

- [Product brief](./docs/PRODUCT_BRIEF.md)
- [Process model](./docs/PROCESS_MODEL.md)
- [Data model and privacy boundaries](./docs/DATA_AND_PRIVACY.md)
- [Build brief for Claude / Cursor](./CLAUDE_BUILD_PROMPT.md)
- [Operations Management specification (v1.0, for approval)](./docs/OPERATIONS_SPEC.md)

## Technology direction

The intended prototype stack is Next.js, React, TypeScript and Tailwind CSS, consistent with the other HR Solutions Lab web projects. The initial experience should run on local synthetic data, with no backend or third-party data transfer.

## Run locally

From the repository root:

```powershell
cd hr-operations-hub
npm.cmd ci
npm.cmd run dev
```

Then open `http://localhost:3000`. Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint` and `npm.cmd run build` before treating this slice as validated.

## Status discipline

The first functional slice is committed: the Operations Radar, training playbook, activity workspace and 45-minute Rapid Recovery flow.

The readiness slice adds:

- **Time-aware readiness.** An open prerequisite alone no longer makes an activity *At risk*. Risk comes from a blocked essential step, a missed deadline, a "waiting on" hold within 24 hours of its deadline, remaining work (including prerequisites) that no longer fits before a deadline or the start, or a prerequisite that is itself at risk. Each status comes with a written explanation.
- **Waiting / blocked holds.** These have a person or team and a short note, and they feed the "Blocked / needs someone else" group in Rapid Recovery.
- **Dependency notes** in the Activity Workspace ("Needs first", "Unlocks").
- **A Radar banner** that always shows the most urgent upcoming activity and its own countdown.
- **Stale-demo handling** for returning visitors. Untouched demos start fresh. Demos with your own changes are kept, and their timeline is moved forward by the time you were away.

Automated tests, typecheck, lint and production build pass locally. **The new UI has not yet been reviewed visually in a browser.** Other playbooks remain in design. The USP is a product hypothesis, not a validated market claim. Only functionality that is implemented and tested will be described as tested.

---
**HR Solutions Lab · People · Process · Technology**
