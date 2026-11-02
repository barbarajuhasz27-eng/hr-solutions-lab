# Smart Onboarding
### From offer acceptance to the first 90 days.

**HR Process Design · Employee Experience · Workflow Coordination**

Smart Onboarding is an independent portfolio project exploring how a structured digital workflow can make employee onboarding more transparent and coordinated across HR, IT, hiring managers, Finance and new employees.

The prototype is designed around a fictional company and synthetic demo data. It is an HR process-design and product-development exercise, not a production HRIS.

## The problem

Onboarding activities often span several teams. Responsibilities, hand-offs and deadlines can be spread across emails, spreadsheets and separate checklists. This makes it difficult for HR and hiring managers to see what is complete, what is overdue and what needs attention before a new employee's first day.

## The proposed solution

A lightweight onboarding workspace that gives HR a central overview of:
- Upcoming employee start dates and active onboarding cases
- Tasks grouped by onboarding stage and responsible function
- Due dates, task status and overdue work
- Key checkpoints at Day 1, Day 30, Day 60 and Day 90
- A consistent task template when a new onboarding case is created

## MVP scope

The first demonstrable version is intended to include:
1. HR dashboard with onboarding and task metrics
2. Onboarding case creation form
3. Individual employee onboarding timeline
4. Task completion and status management
5. Search and basic filtering
6. Demo data stored locally in the browser, with a reset option

## Product decisions

- **Primary user:** HR / People Operations coordinator
- **Secondary stakeholders:** IT, hiring manager, Finance / Payroll and the new employee
- **Experience:** English-language, responsive web application
- **Data:** Synthetic demonstration records only
- **Storage:** Browser local storage for the MVP; no backend or authentication
- **Integrations:** None in the MVP

## Current status

**In development — product brief and implementation specification prepared.**

Features will only be listed as implemented after they have been built and tested.

## Technology direction

Next.js App Router · React · TypeScript · Tailwind CSS · browser local storage.

## Documentation

- [Product brief](./docs/PRODUCT_BRIEF.md)
- [MVP build specification](./docs/BUILD_SPEC.md)
- [Claude implementation prompt](./CLAUDE_BUILD_PROMPT.md)

## Limitations

This is a portfolio prototype, not a production HR system. It does not process real employee data, connect to payroll or HRIS platforms, send notifications, authenticate users or provide legally validated HR guidance. Do not enter real personal or employee information.
