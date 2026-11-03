# HR Operations Hub — Data Model & Privacy Boundaries

## 1. Prototype entities

### Activity

| Field | Purpose |
|---|---|
| `id` | Stable internal identifier |
| `title` | Activity name |
| `activityType` | Training, information session, review-cycle launch, recurring deadline, communication |
| `startsAt` | Planned start date and time |
| `status` | Planned / Preparing / Needs attention / At risk / Recovery / Ready / Completed / Cancelled |
| `coordinator` | Fictional HR coordinator |
| `playbookId` | Source template |
| `recurrence` | Optional recurrence definition |
| `createdAt` | Creation timestamp |
| `updatedAt` | Latest change timestamp |
| `reviewNote` | Short synthetic post-activity learning note |

### Playbook

A reusable template with:
- stable id, title, activity type and description;
- action definitions;
- relative due offsets;
- default owner role;
- criticality;
- estimated effort;
- dependency ids;
- completion evidence prompt;
- optional fallback.

### Action instance

| Field | Purpose |
|---|---|
| `id` | Stable action identifier |
| `activityId` | Parent activity |
| `title` | Concrete operational step |
| `description` | Why the step matters |
| `dueAt` | Calculated due time |
| `ownerRole` | HR / trainer / IT / Facilities / manager / other |
| `ownerName` | Fictional assigned person or unassigned |
| `criticality` | Essential / Important / Optional |
| `estimatedMinutes` | Illustrative effort |
| `dependsOn` | Prerequisite action ids |
| `status` | Not started / In progress / Waiting / Done / Blocked / Skipped |
| `statusNote` | Synthetic note; no sensitive information |
| `fallbackId` | Selected fallback, if any |

## 2. Privacy boundary

The application demonstrates operational coordination, not real employee case management. HR activities may reveal sensitive business or personnel information in a real organisation, so the prototype uses synthetic data only.

### Allowed in synthetic fixtures

- Fictional coordinator and stakeholder names.
- Generic team names such as HR, IT, Facilities and Payroll.
- Fictional training titles or employee-information events.
- Invented dates, action statuses and non-sensitive process notes.
- Generic stakeholder roles.

### Never include

- Real employee names, contact details or identifiers.
- Real training attendance records or performance information.
- Actual salary, bank, tax or social-security information.
- Diagnoses, medical documents or absence reasons.
- Immigration documents, passport or permit details.
- Actual contracts, payslips or insurance documents.
- Confidential employer policies, internal communications or process documents.
- Any real HR operational data copied from previous or current employers.

## 3. Interaction constraints

- No file uploads.
- No email, calendar, Teams, room-booking or IT-system integrations in the MVP.
- Do not request personal information to coordinate an activity.
- Use generic roles and synthetic owners.
- Show that owners and external actions are simulated.
- Do not claim the system has booked a room, contacted IT, invited participants or sent reminders.
- A completed action must result from an explicit user action in the prototype; never auto-complete a task because its due time passed.
- A fallback is a recorded decision, not proof that the fallback was executed.

## 4. Storage and access

The initial prototype uses browser-local synthetic data, with a visible reset-to-demo-data action. There is no backend, authentication, real access control, analytics or external data transfer.

The application is a single-user demonstration. Multiple stakeholder roles are represented as owners, not real authenticated users.

## 5. Future production requirements — not implemented

Before production use, a separate review would be required for:
- real authentication, role-based access and least privilege;
- data classification for sensitive HR activity metadata;
- retention and deletion schedules;
- secure storage, backups and access logging;
- integrations with calendars, email, collaboration, room-booking and IT tools;
- notification consent, delivery and audit trails;
- vendor and processor assessments;
- business continuity and support processes.

The prototype must not imply that its local data model or simulated role assignments satisfy these requirements.
