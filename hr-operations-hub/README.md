# HR Operations Hub
### Employee Services & HR Case Management

**Project status:** In development · product definition  
**Domain:** HR Operations · Employee Services · Workflow Management  
**Portfolio:** HR Solutions Lab

HR Operations Hub is a concept for a structured HR service-delivery workspace. It connects an employee-facing request portal with an HR Operations case queue, so requests have a clear category, owner, service target, status and communication history.

The project focuses on the operational work that happens **after an employee has joined**. It complements Smart Onboarding rather than duplicating its first-90-days journey.

## Product principle

> Every HR request should have a clear owner, a visible next step and a traceable outcome.

## Current scope

The first MVP is planned around three connected surfaces:

1. **Employee Portal** — submit a structured HR request, view its status and read employee-visible updates.
2. **HR Service Desk** — review the queue, triage requests, assign an owner, manage the workflow and send updates.
3. **Operations Insights** — understand request volumes, backlog, overdue cases and resolution patterns using explicitly defined metrics.

The workflow uses synthetic cases and illustrative service targets. It is a portfolio prototype, not a production HR case-management system.

## Project documentation

- [Product brief](./docs/PRODUCT_BRIEF.md)
- [Process model](./docs/PROCESS_MODEL.md)
- [Data model and privacy boundaries](./docs/DATA_AND_PRIVACY.md)
- [Build brief for Claude / Cursor](./CLAUDE_BUILD_PROMPT.md)

## What is not included in the MVP

- Real employee data or confidential HR case records
- Authentication, SSO or production role-based access control
- Email, Teams, calendar, HRIS or payroll integrations
- File uploads or document storage
- Automated legal, payroll or policy decisions
- AI classification or AI-generated responses
- Production SLA commitments or claims of measured efficiency gains

## Technology direction

The intended prototype stack is Next.js, React, TypeScript and Tailwind CSS, consistent with the other HR Solutions Lab web projects. The initial experience should run on local synthetic data, with no backend or third-party data transfer.

## Status discipline

Only functionality that is implemented and tested will be described as implemented. The MVP scope, service targets, data and performance indicators are illustrative until validated.

---
**HR Solutions Lab · People · Process · Technology**
