# Claude Build Prompt — Smart Onboarding MVP

You are working inside the public portfolio repository hr-solutions-lab.

Your task is to implement the Smart Onboarding MVP described in:
- smart-onboarding/README.md
- smart-onboarding/docs/PRODUCT_BRIEF.md
- smart-onboarding/docs/BUILD_SPEC.md

Read these files fully before making changes.

## First: inspect, then plan
1. Inspect the repository root and existing project files.
2. Do not modify the root HR Solutions Lab README or the EU Mobility Navigator repository.
3. Implement the application inside the smart-onboarding/ directory only.
4. Before coding, summarize the proposed file structure and key implementation decisions. Then proceed with the MVP without asking for confirmation unless you encounter a destructive or blocking issue.

## Product outcome
Build a working, responsive HR onboarding workspace for a fictional company. This must be a functional prototype, not a static mockup.

The primary user is an HR / People Operations coordinator. The app must let the user review onboarding cases, create a case, see generated tasks and milestones, update task status, and understand which work needs attention.

## Required MVP
- HR dashboard with metrics derived from data.
- Three fictional seeded onboarding cases with dates relative to the current date.
- Create onboarding form with validation.
- Default task checklist generated for each new case using the offsets and owners in BUILD_SPEC.md.
- Employee detail page with timeline and tasks grouped by stage.
- Task status changes: Not started, In progress, Completed, Blocked.
- Overdue calculation; completed tasks must never count as overdue.
- Search/filter by status and owner where practical.
- localStorage persistence and a visible reset-demo action.
- Responsive layout and accessibility basics.
- Visible demo-only notice; do not enter or request real employee data.

## Design quality
Create a polished B2B SaaS application, not a generic admin template:
- Light warm-neutral background.
- White cards, subtle borders and restrained shadows.
- Deep navy typography, muted teal/blue accent.
- Amber warning and red overdue/blocked states; green completed states.
- Clear hierarchy, consistent spacing and a professional visual system.
- Use lucide-react icons.
- Make desktop and mobile layouts feel intentionally designed.
- Avoid excessive gradients, oversized empty hero sections and meaningless charts.

## Technical direction
Use the stack already used by the EU Mobility Navigator where compatible:
- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- Vitest for utility tests if practical

Create a self-contained Next.js app inside smart-onboarding/. Do not move or refactor the parent repository's files. Include a package.json and all required app configuration within that folder. Pin compatible dependency versions and provide lockfile only if you can generate it accurately; do not invent a lockfile.

Use small, readable components and typed utility functions. Avoid unnecessary abstractions. Use native browser localStorage only on the client and handle hydration safely.

## Data and privacy
All names, roles and organizations must be fictional. Do not import employer records or data from any previous job. No external APIs, analytics, authentication or backend. Show a clear warning that this is a demonstration prototype and must not be used with real employee data.

## Tests and validation
Add tests for:
- Task due-date offsets around month/year boundaries.
- Completion percentage.
- Overdue logic, including the completed-task exception.
- New case task generation.

Run the available checks from the smart-onboarding/ directory:
- npm run typecheck
- npm run lint
- npm test
- npm run build

Fix failures that arise from your code. If a command cannot run because dependencies are unavailable, report that precisely rather than claiming it passed.

## Documentation
Write smart-onboarding/README.md with:
- Product purpose and problem
- Features actually implemented
- Tech stack
- Local setup and run commands
- Demo-data and privacy limitations
- Screenshots section with placeholders only until genuine screenshots exist
- Current status and known limitations

Update the status from "in development" only after the app actually runs and the checks you can run have been completed.

## Working discipline
- Preserve the existing hr-solutions-lab portfolio files.
- Do not create fake business impact metrics.
- Do not claim user testing unless it happened.
- Do not claim legal or payroll compliance.
- Keep all changes inside smart-onboarding/.
- At the end, provide a concise summary of files created, features implemented, commands run and their actual results, and any remaining manual steps.
