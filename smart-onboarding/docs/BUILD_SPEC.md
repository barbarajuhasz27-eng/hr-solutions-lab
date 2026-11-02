# Smart Onboarding — MVP Build Specification

> **Version note.** This is the original MVP specification (v1, task tracking). It has been extended into an Onboarding Readiness & Process Intelligence prototype (v2). In v2, the single default checklist in section 3 is replaced by adaptive workflow modules with mandatory/optional tasks and dependencies, and the data model in section 4 gains `mandatory`, `dependsOn`, `blockedCount`, `blockedReason` and a case-level `workflow` context. See [METHODOLOGY.md](./METHODOLOGY.md) for the current rules and the [product brief](./PRODUCT_BRIEF.md) for the current positioning. The rest of this document is kept as the historical v1 specification.

## 1. Product experience

Build a polished, responsive HR operations dashboard for a fictional mid-sized company. The application is an English-language demo for HR / People Operations coordinators.

The experience should feel like a credible B2B SaaS product: calm, clear, structured and operationally useful. Avoid generic gradients, oversized marketing hero sections and decorative charts with no decision value.

### Visual direction
- Light warm-neutral page background.
- White or near-white cards with subtle borders.
- Deep navy / charcoal typography.
- Muted teal or blue as the primary action color.
- Amber for due-soon warnings, red for overdue / blocked, green for completed.
- Consistent spacing, restrained shadows and clear typography.
- Responsive sidebar navigation on desktop; compact navigation on mobile.
- Use lucide-react icons consistently.
- No external image dependency is necessary.

## 2. Main screens

### A. HR dashboard (root route)
Header:
- Product name: Smart Onboarding
- Context label: People Operations Workspace
- Main action: New onboarding

Metric cards:
- Upcoming starts (next 30 days)
- Active onboardings
- Tasks overdue
- Overall task completion

Main content:
- Needs attention list: overdue and blocked tasks, showing employee, task, owner and due date.
- Upcoming starts list: employee, role, department and start date.
- Active onboarding table/cards: employee, stage, progress and next milestone.
- Clear empty states and loading-safe hydration.

### B. Create onboarding case
Use a modal or dedicated form with validation:
- Employee name (required)
- Job title (required)
- Department (required)
- Hiring manager (required)
- Location (required; free text is acceptable)
- Start date (required)
- Employment type (Full-time / Part-time / Fixed-term)

On successful submission:
- Create an onboarding record.
- Generate the default task template.
- Calculate task due dates relative to the start date.
- Navigate to the new employee's detail page or show a clear success state.
- Do not request personal email, phone, address, date of birth or other unnecessary personal data.

### C. Employee onboarding detail
Show:
- Employee name, job title, department, manager, location and start date.
- Overall completion percentage.
- Current stage and next milestone.
- A chronological onboarding timeline.
- Task checklist grouped by stage.
- Task owner, due date and status.
- Ability to change task status: Not started, In progress, Completed, Blocked.
- Clear overdue labels calculated from due date and completion status.
- A way to return to the dashboard.

Stages:
1. Pre-boarding
2. Day 1
3. First 30 days
4. Day 60
5. Day 90

### D. Task filters
On the dashboard and detail view where appropriate, allow filtering by status and owner. Include a simple search across employee name, role and department if practical.

## 3. Task template

Create a reusable default checklist. Each task has:
- id
- title
- description
- owner group
- stage
- offset in days relative to start date
- status
- optional completedAt date

Suggested default tasks:

| Stage | Task | Owner | Due offset |
|---|---|---|---:|
| Pre-boarding | Prepare employment documentation checklist | HR | -10 |
| Pre-boarding | Confirm payroll setup requirements | Finance / Payroll | -7 |
| Pre-boarding | Prepare laptop and equipment | IT | -5 |
| Pre-boarding | Create system accounts and access | IT | -2 |
| Pre-boarding | Prepare desk and building access | Facilities | -2 |
| Pre-boarding | Create first-week agenda | Hiring manager | -2 |
| Day 1 | Welcome meeting and company orientation | HR | 0 |
| Day 1 | Team introduction and role overview | Hiring manager | 0 |
| Day 1 | Confirm equipment and system access | IT | 0 |
| First 30 days | First-month check-in | Hiring manager | 30 |
| First 30 days | New employee feedback check-in | HR | 30 |
| Day 60 | Role progress and support check-in | Hiring manager | 60 |
| Day 90 | 90-day review and next-step discussion | HR + Hiring manager | 90 |

Task templates are generic workflow examples, not legal or payroll instructions. Do not present them as a compliance checklist.

## 4. Data model

Use TypeScript types similar to:

type EmploymentType = "Full-time" | "Part-time" | "Fixed-term";
type TaskStatus = "Not started" | "In progress" | "Completed" | "Blocked";
type OnboardingStage =
  | "Pre-boarding"
  | "Day 1"
  | "First 30 days"
  | "Day 60"
  | "Day 90";

type OnboardingTask = {
  id: string;
  title: string;
  description: string;
  owner: string;
  stage: OnboardingStage;
  dueDate: string; // ISO date
  status: TaskStatus;
  completedAt?: string;
};

type OnboardingCase = {
  id: string;
  employeeName: string;
  jobTitle: string;
  department: string;
  hiringManager: string;
  location: string;
  startDate: string; // ISO date
  employmentType: EmploymentType;
  tasks: OnboardingTask[];
  createdAt: string;
};

## 5. Demo data and persistence

- Seed 3 fictional onboarding cases on first load.
- Use fictional names and company-neutral information.
- Derive seed start dates relative to the current date so the demo remains relevant over time.
- Persist changes in browser localStorage.
- Include a visible Reset demo data action with confirmation.
- Handle missing, malformed or outdated localStorage safely by restoring demo data.
- Avoid server/client hydration mismatches in Next.js.
- Clearly label the app as a demo; never encourage entry of real employee data.

## 6. Technical requirements

Use:
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- lucide-react for icons
- Vitest for important utility tests if practical

Keep the code modular. Suggested organization:

smart-onboarding/
  app/
    layout.tsx
    page.tsx
    onboarding/
      [id]/
        page.tsx
  components/
    app-shell.tsx
    dashboard/
    onboarding/
    tasks/
    ui/
  lib/
    dates.ts
    onboarding-store.ts
    seed-data.ts
    task-templates.ts
    metrics.ts
  types/
    onboarding.ts
  tests/
  public/
  README.md
  package.json
  tsconfig.json
  next.config.ts
  postcss.config.mjs

Do not over-engineer. Prefer a simple localStorage-backed client-side MVP over a backend.

## 7. Quality and acceptance criteria

- The application runs locally with documented commands.
- No TypeScript errors.
- Production build succeeds.
- Dashboard metrics are derived from actual case/task data, not hardcoded.
- Creating a case generates all default tasks with correct date offsets.
- Updating a task changes its status everywhere it is displayed.
- Completion percentage is calculated consistently from the total task count.
- Completed tasks are not marked overdue.
- Blocked tasks are visible in the attention area.
- Date calculations handle month/year boundaries and local date values correctly.
- Reset demo restores the original synthetic sample cases.
- Layout works on desktop and mobile.
- Form labels, keyboard access, focus states and status text are accessible.
- Empty and invalid states are handled clearly.

## 8. Out of scope / guardrails

- No authentication or authorization.
- No real employee data.
- No backend or external integrations.
- No email notifications.
- No legal, payroll or tax advice.
- No claims of quantified business impact.
- No use of employer-confidential material.
- Clearly distinguish implemented functionality from planned ideas.
