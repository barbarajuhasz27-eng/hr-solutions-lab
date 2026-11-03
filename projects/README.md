# Portfolio Overview

This document is the navigation page for the HR Solutions Lab project collection.

## Featured projects

### EU Mobility Navigator
- **Case study:** [EU Mobility Navigator](../case-studies/eu-mobility-navigator.md)
- **Domain:** International mobility and employment pathways
- **Status:** Private prototype; not publicly deployed. Public case study only; source repository remains private.
- **Portfolio role:** Demonstrates life-first product framing, international mobility domain research, scope governance, user-journey design and evidence-aware digital product development.
- **Current limitation:** All legal rules remain unverified; no external user testing has been conducted and there is no public demo URL.

### Smart Onboarding
- **Live demo:** https://smart-onboarding-barbara-ed0f.vercel.app/
- **Project folder:** https://github.com/barbarajuhasz27-eng/hr-solutions-lab/tree/main/smart-onboarding
- **Domain:** Employee experience, onboarding process design and HR reporting
- **Status:** Live demo available. Feature-complete prototype running on synthetic data; no user testing conducted.
- **Implemented:** Employee Portal and Demo Mode; Learning Center; feedback, check-ins, scheduling and action plans; rule-based readiness, dependencies and process insights; Experience & Process Intelligence reporting with KPI definitions and a five-employee minimum for experience ratings.
- **Technology:** Next.js, React, TypeScript, Tailwind CSS; Vitest and Testing Library (332 tests).
- **Not included:** authentication, backend, integrations (HRIS, LMS, calendar) and real employee data. The role switch is a simulated preview.
- **Portfolio role:** Demonstrates process analysis, stakeholder coordination, privacy-aware product design, transparent KPI definitions and end-to-end prototype development.
- **Documentation:** [README](../smart-onboarding/README.md) · [Product brief](../smart-onboarding/docs/PRODUCT_BRIEF.md) · [Methodology](../smart-onboarding/docs/METHODOLOGY.md)

## In development

### HR Operations Hub
- **Project folder:** [HR Operations Hub](../hr-operations-hub/)
- **Domain:** HR Operations readiness, operational playbooks and workflow coordination
- **Target user:** HR Generalists and lean HR teams
- **Status:** First functional slice committed (training playbook, Operations Radar, Activity Workspace and Rapid Recovery); 13 tests, typecheck, lint and production build passing
- **MVP surfaces:** Operations Radar, Playbook Library, Activity Workspace and Rapid Recovery
- **Proposed USP:** Time-aware HR playbooks that make owners, lead times and dependencies visible, with a practical recovery view when an activity is running late. This is a product hypothesis, not a validated market-uniqueness claim.
- **Portfolio role:** Demonstrates practical HR Operations process design, cross-functional coordination, readiness logic and workflow governance.
- **Documentation:** [Product brief](../hr-operations-hub/docs/PRODUCT_BRIEF.md) · [Process model](../hr-operations-hub/docs/PROCESS_MODEL.md) · [Data & privacy boundaries](../hr-operations-hub/docs/DATA_AND_PRIVACY.md) · [Build prompt](../hr-operations-hub/CLAUDE_BUILD_PROMPT.md)

## Planned projects

| Project | Domain | Current status |
|---|---|---|
| Compensation Intelligence | Compensation analytics using synthetic data | Planned |

## Documentation standard

Every project should document:
1. Problem statement and target users
2. Business context and requirements
3. Proposed solution and user journey
4. Personal contribution and decisions
5. Implementation status and demonstrable features
6. Testing approach and results, where available
7. Limitations, risks and next steps

Do not describe planned features as implemented. Do not claim business impact without evidence. Use synthetic data and avoid confidential employer information.
