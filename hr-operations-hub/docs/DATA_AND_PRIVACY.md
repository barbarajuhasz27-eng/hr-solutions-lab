# HR Operations Hub — Data Model & Privacy Boundaries

## 1. Prototype entities

### Case

| Field | Purpose |
|---|---|
| `id` | Stable internal identifier |
| `reference` | Human-readable request reference |
| `createdAt` | Submission timestamp |
| `updatedAt` | Latest activity timestamp |
| `requester` | Fictional employee name and synthetic team |
| `category` | Controlled service category |
| `topic` | Controlled request topic |
| `subject` | Short non-sensitive summary |
| `description` | Synthetic, non-sensitive request detail |
| `status` | Controlled case lifecycle state |
| `priority` | Standard / Important / Urgent |
| `queue` | Responsible service queue |
| `owner` | Fictional accountable case owner |
| `firstResponseDueAt` | Illustrative first-response target |
| `resolutionDueAt` | Illustrative resolution target |
| `resolvedAt` | Resolution timestamp, if resolved |
| `closedAt` | Closure timestamp, if closed |
| `reopenedCount` | Number of reopen events |

### Case activity

Each status change, assignment change, employee-visible update and internal note should create a chronological activity item.

Activity fields:

- `id`
- `caseId`
- `type` (status, assignment, employee message, internal note, priority, resolution)
- `audience` (employee-visible or internal)
- `author` (fictional actor)
- `createdAt`
- `body` (synthetic and non-sensitive)

### Service catalogue

Each request type should define:

- stable category and topic ids;
- employee-facing label and short description;
- minimum form fields;
- default queue;
- whether the request can be handled in the prototype;
- an optional illustrative service-target profile.

## 2. Privacy boundary

The application handles HR service scenarios, which can involve sensitive or confidential information in a real organisation. The prototype must therefore avoid realistic personal data, even for demonstration.

### Allowed in synthetic fixtures

- Fictional names and invented employee ids.
- Generic departments and job-family labels.
- Non-sensitive request summaries such as “Please provide an employment confirmation letter.”
- Illustrative dates and status events.
- Fictional team and queue names.

### Never include

- Real employee names, contact details or identifiers.
- Actual salary, bank, tax or social-security information.
- Diagnoses, medical documents or detailed sickness/absence reasons.
- Immigration documents, passport or permit details.
- Real contracts, payslips or insurance documents.
- Confidential employer policies or internal case correspondence.
- Any real HR records copied from previous or current employers.

## 3. Form design constraints

- Do not request file uploads.
- Do not collect bank account numbers, tax numbers, identity document numbers or medical details.
- For payroll requests, ask for a broad issue type and a safe reference period only; show a warning not to enter bank or tax information.
- For time/absence administration, ask only for the administrative question; do not request a diagnosis or reason for illness.
- Keep free-text descriptions short and show a visible warning not to include sensitive personal data.
- Prefer controlled fields over open-ended text wherever practical.

## 4. Storage and access

The initial prototype should use browser-local synthetic data only, with a visible reset-to-demo-data action. There is no backend, authentication, real access control, analytics or external data transfer.

A simulated Employee / HR view switch is for demonstration only. It must not be described as security. Internal notes should nevertheless be omitted from the employee view in the application logic, so the prototype demonstrates the intended information boundary.

## 5. Future production requirements — not implemented

Before any production use, a separate design and legal review would be required for:

- lawful purpose and legal basis for each category of employee data;
- data minimisation and special-category data handling;
- real authentication, role-based access and least privilege;
- segregation of employee-facing and confidential HR information;
- retention and deletion schedules;
- audit history and access logging;
- secure storage, encryption, backups and incident response;
- vendor and processor assessments;
- data-subject rights and employee transparency;
- accessibility, security testing and operational support.

The prototype must not imply that implementing the UI model satisfies these requirements.
