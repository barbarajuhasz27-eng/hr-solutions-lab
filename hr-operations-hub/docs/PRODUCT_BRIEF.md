# HR Operations Hub — Product Brief

## 1. Product summary

HR Operations Hub is an **Employee Services & HR Case Management** prototype for HR Operations teams.

It provides one structured route for employees to raise common HR requests and one operational workspace for HR teams to receive, triage, assign, resolve and report on those requests.

> Every HR request should have a clear owner, a visible next step and a traceable outcome.

The prototype is designed to demonstrate HR service-delivery thinking: structured intake, transparent case ownership, consistent workflow states, employee communication and useful operational reporting.

## 2. Problem statement

Employees often contact HR through a mixture of shared inboxes, direct messages, conversations and forms. Requests can arrive without the information needed to process them, ownership may be unclear, follow-ups can become fragmented, and employees may not know whether anyone is working on their request.

For HR Operations, this creates avoidable coordination work and makes it difficult to understand demand: which request types are increasing, where cases are waiting, which handovers are delayed and what is accumulating in the backlog.

The prototype explores how a consistent case workflow could make service delivery more visible and manageable without turning HR into an impersonal ticket factory.

## 3. Target users and stakeholders

### Primary user — Employee

Needs a straightforward way to submit a request, understand what information is needed, see progress and receive clear updates without chasing HR through multiple channels.

### Primary operational user — HR Operations Specialist

Needs a reliable queue, structured case information, clear priority and service target, ownership, work notes, follow-up reminders and a traceable history.

### Supporting stakeholders

- Payroll specialist — handles payroll-related cases routed to the payroll queue.
- Benefits specialist — handles benefits and insurance administration requests.
- HR Systems specialist — handles employee self-service and HR system access issues.
- People Partner / HR generalist — handles employee lifecycle and policy questions outside standard HR Operations processing.

The MVP represents stakeholders through queues and case owners. It does not implement separate stakeholder accounts or real permissions.

## 4. Product goals

1. Give employees one clear entry point for common HR service requests.
2. Collect only the information needed to route and process each request.
3. Make case ownership, status, priority and service target visible to HR Operations.
4. Keep employee-visible communication separate from internal HR work notes.
5. Make waiting states and hand-offs explicit rather than hiding them in free text.
6. Provide operational insights with transparent definitions and no misleading composite score.
7. Demonstrate how a repeatable HR service process can be designed, documented and evaluated.

## 5. MVP functional scope

### A. Employee Portal

- Overview of the employee's submitted requests.
- New request flow with a controlled request category and topic.
- Guided form fields that change based on the selected request type.
- Confirmation with a case reference number and expected next step.
- Case detail page with current status, last update and employee-visible messages.
- Ability to add a clarification or reply when HR requests information.
- Clear guidance not to enter sensitive personal details or attach confidential documents.

### B. HR Service Desk

- Queue overview with total open cases, unassigned cases, cases awaiting input and overdue cases.
- Search and filters by status, category, queue, owner, priority and age.
- Case detail with request summary, structured information, service target, assigned queue and owner.
- Triage actions: accept, assign, reprioritise, request information, place on hold, resolve and close.
- Internal notes that are not visible in the employee portal.
- Employee-visible updates that are clearly separated from internal notes.
- Chronological activity timeline for status and ownership changes.
- Reopen flow for a case that needs further work.

### C. Operations Insights

- Incoming request volume by category and period.
- Open backlog by status and queue.
- Cases past their illustrative service target.
- Median resolution time for resolved cases, with the calculation displayed.
- Reopened-case count and rate.
- Volume and ageing by request category.

Every metric must have a definition, a stated population and a visible synthetic-data disclaimer. No weighted service-quality score.

## 6. Initial request taxonomy

Use a deliberately small taxonomy for the MVP:

| Category | Example topics | Suggested queue |
|---|---|---|
| Employment documents | Employment confirmation, contract copy, standard HR letter | HR Operations |
| Personal data changes | Address, bank details, emergency contact | HR Operations |
| Payroll questions | Payslip clarification, payroll data correction request | Payroll |
| Benefits & insurance | Benefits information, insurance administration | Benefits |
| Time & absence administration | Leave balance question, absence process question | HR Operations |
| HR systems & access | Employee self-service access, HR portal issue | HR Systems |
| Policy & general HR questions | Policy clarification, who-to-contact question | People Support |

The taxonomy is a product-design starting point, not a statement of any employer's actual policies or service catalogue. Do not request diagnoses, medical explanations, bank account numbers, identity documents or other sensitive details in the prototype.

## 7. Case workflow

Use the following controlled states:

1. **Submitted** — request received; not yet triaged.
2. **In review** — HR has accepted the request and is assessing it.
3. **In progress** — an owner is actively processing the case.
4. **Waiting for employee** — the employee needs to provide clarification.
5. **Waiting for another team** — another internal queue or specialist needs to act.
6. **Resolved** — HR has recorded the outcome and sent an update.
7. **Closed** — the case is complete.
8. **Reopened** — further work is required after resolution.

A request should not silently disappear from the queue when it is waiting for someone else. Waiting states must remain visible in the backlog and reporting.

## 8. Priority and service targets

Use three simple illustrative priorities:

- **Standard**
- **Important**
- **Urgent**

The demo may use example response and resolution targets, but these must be labelled **illustrative service targets — not an actual company SLA**. The prototype must show whether a case is within target, approaching target or overdue, with the underlying due date visible. Do not imply that all requests have the same urgency or that a prototype target represents a legal deadline.

## 9. Core user journeys

### Employee journey

1. Employee opens the portal.
2. Employee selects a request category and topic.
3. The form displays only the relevant non-sensitive fields.
4. Employee submits the request and receives a case reference.
5. Employee checks the status and reads employee-visible updates.
6. If HR asks for more information, the employee replies in the same case.
7. Employee sees the resolution summary and closure status.

### HR Operations journey

1. HR opens the service desk queue.
2. HR reviews new and overdue cases.
3. HR triages a new request, checks completeness and assigns the correct queue and owner.
4. HR sets or confirms the illustrative priority and service target.
5. HR records internal work notes and sends employee-visible updates as appropriate.
6. If an external or internal hand-off is required, HR moves the case to a visible waiting state.
7. HR resolves and closes the case with an employee-visible outcome.
8. HR reviews operations insights to identify recurring patterns.

## 10. Prototype success criteria

The prototype is successful when a reviewer can:

- Submit a request through the Employee Portal and receive a reference number.
- Find the request in the HR Service Desk without re-entering the data.
- Assign the request to a queue and owner.
- Change the case status and see the employee-facing view update.
- Add an internal note and verify it is not shown to the employee.
- Request information and receive an employee reply within the same case.
- See waiting and overdue cases in the queue.
- Understand every displayed operational KPI from its written definition.
- Reset the application to its original synthetic demo state.

These are test scenarios, not measured business outcomes.

## 11. Non-goals

- Production HR case management or a replacement for an HRIS.
- Real authentication or access control.
- Handling real payroll, benefits, health or personal case data.
- Uploading identity, medical or contract documents.
- Sending real email or notifications.
- Making payroll calculations or employment-law interpretations.
- Automatically approving employee requests.
- AI classification, sentiment analysis or AI-generated HR decisions.
- Predicting employee behaviour or rating employees.
- Claims about shorter resolution times, lower workload or better employee satisfaction without user testing and real evidence.

## 12. Privacy and responsible-use principles

- Synthetic data only.
- No real employee names, contact details, salary values, bank details, health data or actual HR case content.
- No attachment upload.
- No public free-text case examples containing personal data.
- Clear distinction between employee-visible messages and internal HR notes.
- Simulated employee/HR view is a demonstration switch, not authentication or access control.
- No analytics or third-party calls in the prototype.
- Any future production design would require a separate privacy, security, retention, access-control and processor assessment.

## 13. Positioning within HR Solutions Lab

- **Smart Onboarding:** coordinates the new-hire journey from offer acceptance through Day 90.
- **HR Operations Hub:** coordinates ongoing HR service requests after employees are onboarded.
- **EU Mobility Navigator:** explores life-first destination discovery and bounded mobility orientation.

This separation creates three complementary examples: employee lifecycle process design, ongoing HR service delivery and international mobility product thinking.
