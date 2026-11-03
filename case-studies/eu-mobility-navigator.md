# EU Mobility Navigator
### Life-first exploration and structured mobility orientation

**Project status:** Private prototype · not publicly deployed · source repository private  
**Domain:** International mobility · HR technology · product and process design  
**Last updated:** 3 November 2026

EU Mobility Navigator (EMN) explores a different starting point for international mobility: rather than beginning with a visa category, it begins with the life someone wants to build. It connects personal exploration of European destinations with a carefully bounded view of what a move could involve.

> **Start with the life. Work backwards to the path.**

This is an independent product concept and working prototype. It is not an immigration authority, legal adviser or eligibility checker. Its legal assessment content remains unverified and is not offered as public legal guidance.

## 1. The problem

International relocation is often approached as a sequence of administrative questions: nationality, permit type, requirements and documents. That can make it difficult for someone at an early stage to understand which places might suit the life they want, or how to move from curiosity to a realistic next step.

At the same time, mobility information is fragmented across legal instruments, official guidance and country-specific procedures. A simple questionnaire can easily create false certainty when it treats incomplete information as a negative answer or presents a preliminary rule comparison as an eligibility decision.

EMN explores how to connect the human and practical sides of relocation while keeping legal scope, uncertainty and evidence visible.

## 2. Product concept

The experience follows a staged journey:

1. **Explore** — reflect on lifestyle, aspirations and the kind of everyday life someone is looking for.
2. **Discover** — browse a curated catalogue of 46 European cities, with editorial destination experiences for selected locations.
3. **Compare** — compare a shortlist descriptively across lifestyle dimensions and practical context, without a compatibility score or city ranking.
4. **Consider opportunities and belonging** — surface a small number of curated study, work, business and community doorways where researched information is available.
5. **Understand mobility context** — establish the relevant mobility regime before showing any route-specific assessment.
6. **Explore possible next steps** — for a limited set of covered situations, show an initial, source-linked and explicitly unverified assessment.

The product does not claim that every destination or mobility situation is covered. Unsupported or incomplete contexts stop at an explanation of what has not been assessed; they are not turned into negative outcomes.

## 3. Scope of the current prototype

The current catalogue contains 46 cities across 31 countries. Three destinations have deeply authored editorial experiences: Vienna, Berlin and Lisbon. Other cities remain available through the base catalogue and a simpler destination view.

The legal-assessment layer is intentionally much narrower than the destination catalogue:

| Area | Current assessment scope |
|---|---|
| Austria | Selected routes for non-EU nationals |
| Germany | Three selected routes for non-EU nationals |
| Spain | EU free movement for an EU citizen taking up employment |

This table describes implemented prototype coverage, not legal approval. Every production rule remains marked **unverified**. Passing conditions are shown as requiring verification; unassessed situations are not described as ineligible.

## 4. Product and architecture decisions

A central design decision is to keep the life-exploration model separate from legal assessment. Lifestyle preferences do not determine legal outcomes, and the legal engine does not use the user's personal vision as an eligibility input.

Other important decisions include:

- **No city scores or rankings.** Comparisons are descriptive and give shortlisted cities equal visual weight.
- **Mobility regime before route selection.** The system distinguishes EU free movement from third-country immigration and only runs an assessment where country coverage and the relevant regime match.
- **Explicitly bounded rules.** Each assessment has a defined country, pathway and source scope. Unknown or unsupported conditions remain visible.
- **Traceable evidence.** Legal rules, thresholds, sources, effective periods and review states are represented separately from editorial content and product hypotheses.
- **No false certainty.** Missing information, a condition needing external verification and a condition outside the implemented model are different states.
- **Privacy by default.** The prototype has no application backend, database, analytics or user accounts. Personal exploration and questionnaire state remain in browser session storage. A proposed invitation-only beta gate uses a separate, strictly necessary access cookie.

The prototype is built with Next.js, React, TypeScript and Tailwind CSS. It uses a deterministic, source-backed rule engine for the limited assessment paths; it does not use generative AI to decide legal outcomes. AI-assisted development tools were used during implementation, alongside independent product decisions, requirements work, testing and documentation.

## 5. My contribution

I developed the product concept and translated it into a structured product and delivery model, including:

- product positioning and the life-first experience principle;
- user journeys, functional scope and the transition from exploration to mobility orientation;
- domain boundaries for vision, destination data, mobility context, profile information and legal assessment;
- requirements for country and regime coverage, uncertainty states and evidence provenance;
- research coordination and source-to-claim documentation for selected mobility topics;
- UX structure, interaction flows and user-facing explanations of limitations;
- privacy, security and legal-governance requirements;
- test expectations, quality review and project documentation.

Implementation was developed with AI-assisted coding tools. My role focused on product ownership, problem framing, architecture and scope decisions, review of outputs, testing priorities and documentation—not a claim that every line of code was written manually.

## 6. Validation and evidence

The latest recorded technical checkpoint (1 November 2026, Programme Batch 3) reports:

- 1,326 automated tests passing;
- typecheck and production build passing;
- lint with zero errors and a known baseline of existing warnings;
- a content-source check across 133 URLs, with one known intermittent timeout.

These are the project's recorded results, not a fresh test run for this portfolio case study.

No external user testing has been conducted. There are no validated business outcomes, conversion results or measured relocation outcomes. The application has not been deployed; there is no public demo URL.

## 7. Limitations and responsible-use boundaries

- **Not legal advice.** EMN is not affiliated with a government authority and does not make visa or residence-permit decisions.
- **No legal sign-off.** All production rule records remain unverified. Qualified reviewers have not approved the rules, sources or threshold interpretations.
- **Limited assessment coverage.** Implemented pathways cover only the countries, mobility regimes and situations listed above. Research notes for other situations do not mean those situations are assessed.
- **Not user-tested.** Usability and comprehension have not been validated with external participants.
- **Not production-operated.** The app has no live public deployment. Privacy and terms pages are drafts; operator identity, hosting and log-retention disclosures and qualified legal review remain open.
- **No personal-data service.** The prototype has no accounts or backend. It is not designed for real employee, applicant or immigration case records.

The source repository remains private while technical, legal and operational release work continues. This public case study documents the product approach and current limitations; it does not expose the source code or offer access to the prototype.

## 8. Next steps

1. Complete the dependency and security review before any deployment.
2. Resolve operator, privacy, terms and hosting decisions.
3. Obtain qualified, documented legal review for each rule that may be exposed to testers.
4. Re-run and record the release quality gates on the exact release commit.
5. Conduct a controlled usability study only after the legal and operational gates are satisfied.
6. Add authentic product screenshots to this case study when they are captured.

---

*EU Mobility Navigator is an independent product-development project within HR Solutions Lab. It demonstrates product thinking at the intersection of HR domain knowledge, international mobility, structured research and digital solution design. It does not demonstrate legally validated immigration advice.*
