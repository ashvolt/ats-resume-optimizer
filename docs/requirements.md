# Requirements

**Status:** Draft v1 · **Last updated:** 2026-07-15

Consolidated functional and non-functional requirements for v1. Each feature area has a deeper spec in [features/](features/); this document is the traceable checklist version. Requirement IDs are stable — reference them in issues/PRs/tests (e.g., "closes FR-JD-3").

MVP scope is marked; non-MVP items are tracked but deferred — see [ROADMAP.md](../ROADMAP.md).

## Functional requirements

### JD import (FR-JD) — [features/jd-parser.md](features/jd-parser.md)

| ID | Requirement | MVP |
|---|---|---|
| FR-JD-1 | User can paste raw JD text | Yes |
| FR-JD-2 | User can supply a JD URL; app attempts to scrape and extract the posting text | Yes |
| FR-JD-3 | Scraping failures degrade gracefully to a clear "paste instead" prompt, never a silent empty result | Yes |
| FR-JD-4 | Imported JD text is cleaned (HTML stripped, boilerplate/apply-now text removed) | Yes |
| FR-JD-5 | JD is split into labeled sections (Requirements, Responsibilities, Preferred, About/Benefits, Other) with per-section weight | Yes |
| FR-JD-6 | JD language is detected and stored on the record | Yes |
| FR-JD-7 | User can manually edit the cleaned JD text before analysis | Yes |
| FR-JD-8 | Multiple JD records can be stored and switched between | No (schema supports it; UI deferred) |

### AI provider configuration (FR-PROV) — [features/ai-provider.md](features/ai-provider.md)

| ID | Requirement | MVP |
|---|---|---|
| FR-PROV-1 | User can add a provider config (OpenAI, Anthropic, or Ollama) with credentials/endpoint | Yes |
| FR-PROV-2 | App functions fully with zero providers configured (deterministic-only mode) | Yes |
| FR-PROV-3 | Credentials are encrypted at rest in browser storage | Yes |
| FR-PROV-4 | Every AI call surfaces token usage and an estimated cost after completion | Yes |
| FR-PROV-5 | Provider/model failures (auth, rate limit, timeout) surface a specific, actionable error, never a silent no-op | Yes |
| FR-PROV-6 | User can remove/rotate stored credentials | Yes |
| FR-PROV-7 | Additional providers (Gemini, Groq, OpenRouter, LM Studio, custom OpenAI-compatible) addable via the same adapter interface | No (interface ships in MVP; extra adapters are post-MVP contributions) |
| FR-PROV-8 | Cost/latency shown before an AI action is confirmed, not only after | No — see [architecture.md open question 5](architecture.md#13-open-questions-and-assumptions) |

### Resume import (FR-RES) — [features/resume-import.md](features/resume-import.md)

| ID | Requirement | MVP |
|---|---|---|
| FR-RES-1 | User can paste plain resume text | Yes |
| FR-RES-2 | User can upload a Markdown file | Yes |
| FR-RES-3 | User can upload a PDF; text and section structure are extracted | Yes |
| FR-RES-4 | Extracted structure is always shown for user confirmation/edit before proceeding — never trusted silently | Yes |
| FR-RES-5 | Resume is normalized into the Resume JSON schema ([architecture.md §3.1](architecture.md#31-resume-json)) as the single source of truth | Yes |
| FR-RES-6 | DOCX upload | No — future |

### ATS analysis (FR-ATS) — [features/ats-engine.md](features/ats-engine.md)

| ID | Requirement | MVP |
|---|---|---|
| FR-ATS-1 | Score is computed deterministically with no AI provider required | Yes |
| FR-ATS-2 | Score computation is a pure function of (Resume JSON, JD JSON) — same input always yields same score | Yes |
| FR-ATS-3 | Every point deducted has a stated, specific reason (missing keyword, no quantified impact, weak verb, etc.) | Yes |
| FR-ATS-4 | Every deduction has an associated recommendation | Yes |
| FR-ATS-5 | Keywords are categorized (language/framework/database/cloud/tool/methodology) | Yes |
| FR-ATS-6 | JD sections are weighted (Requirements > Responsibilities > Preferred > Benefits=0) | Yes |
| FR-ATS-7 | Formatting-hazard detection (tables, images, non-standard headers that break ATS parsers) | Yes |
| FR-ATS-8 | When a provider is configured, an AI layer adds semantic evaluation (relevance, phrasing strength) as an attributed, separate layer | Yes (gated on provider presence) |
| FR-ATS-9 | Score is never presented as a guarantee of passing a real ATS — coverage-estimate framing is in-product, not just docs | Yes |

### AI optimization & interactive review (FR-OPT) — [features/resume-editor.md](features/resume-editor.md)

| ID | Requirement | MVP |
|---|---|---|
| FR-OPT-1 | Every AI-originated change is shown as original → suggested → reason before any resume mutation | Yes |
| FR-OPT-2 | User can accept or reject each suggestion individually | Yes |
| FR-OPT-3 | User can request a suggestion be regenerated (rewrite again) | Yes |
| FR-OPT-4 | User can request a suggestion be adjusted: shorten / expand / more professional / more ATS-focused / more human-sounding | Yes |
| FR-OPT-5 | AI is instructed and constrained to never introduce a skill/tool/claim absent from the source resume | Yes |
| FR-OPT-6 | Accepting a suggestion updates the working Resume JSON and creates a new `ResumeVersion` | Yes |
| FR-OPT-7 | Rejecting a suggestion leaves the resume unchanged and records the rejection (for future "don't suggest this again" tuning) | Yes |

### Live scoring (FR-LIVE)

| ID | Requirement | MVP |
|---|---|---|
| FR-LIVE-1 | Accepting a suggestion triggers automatic re-scoring | Yes |
| FR-LIVE-2 | Score history across versions is viewable as a progression (before → after each accepted change) | Yes |
| FR-LIVE-3 | UI communicates progress toward 80%/90%/100% without encouraging keyword stuffing (i.e., no reward signal for adding unsubstantiated keywords) | Yes |

### Preview & editing (FR-PREV) — [features/markdown-engine.md](features/markdown-engine.md)

| ID | Requirement | MVP |
|---|---|---|
| FR-PREV-1 | Resume has a live Markdown preview | Yes |
| FR-PREV-2 | Side-by-side structured editor and Markdown view stay in sync in both edit directions | Yes |
| FR-PREV-3 | Diff viewer shows changes between any two versions | Yes |
| FR-PREV-4 | Version history is browsable and a prior version can be restored as the new working version | Yes |

### Export (FR-EXP) — [features/export-engine.md](features/export-engine.md)

| ID | Requirement | MVP |
|---|---|---|
| FR-EXP-1 | Export to Markdown file | Yes |
| FR-EXP-2 | Export to PDF | Yes |
| FR-EXP-3 | Export pipeline is plugin-based (`Exporter` interface) so new formats don't require core changes | Yes |
| FR-EXP-4 | DOCX / LaTeX / multiple templates | No — future, tracked in [ROADMAP.md](../ROADMAP.md) |
| FR-EXP-5 | Google Docs / Gmail push | No — dropped per [ADR-007](decisions/ADR-007.md) |

## Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Zero mandatory backend.** The full import→score→optimize (deterministic)→export loop works with the app served as static files and no server-side component running. |
| NFR-2 | **Zero mandatory cost.** No feature on the critical path requires a paid API call. |
| NFR-3 | **Data locality.** Resume/JD content and provider credentials are never transmitted except directly to a provider the user explicitly configured, and only on an explicit AI action. |
| NFR-4 | **Explainability.** No score or AI suggestion is presented without a stated reason. |
| NFR-5 | **Determinism where claimed.** The deterministic ATS engine must be a pure function — no hidden state, no time-based variance — verified by golden-set tests. |
| NFR-6 | **Type safety on contracts.** `ProviderAdapter`, `StorageAdapter`, `Exporter`, and the Resume/JD schemas are TypeScript-typed and are the canonical contract definition ([ADR-005](decisions/ADR-005.md)). |
| NFR-7 | **Modularity.** `core/*` modules do not depend on React; new providers/exporters/parsers are addable by implementing an interface, without modifying unrelated modules. |
| NFR-8 | **Resilience.** Network-dependent operations (JD scraping, AI calls) have explicit timeouts and never leave the UI in an indefinite pending state. |
| NFR-9 | **Accessibility.** Core review/accept-reject flows are keyboard-navigable and screen-reader-labeled (WCAG 2.1 AA as the target, not yet audited — track as a pre-release gate). |
| NFR-10 | **Test coverage on core.** `core/*` modules (especially `ats/`, `providers/`, `markdown/`) carry unit tests with fixture-based golden sets; UI components are tested for the accept/reject/diff interaction flows specifically, not exhaustively. |
| NFR-11 | **No silent telemetry.** Any future analytics/error-reporting is opt-in, off by default, and separately documented before being added. |

## Acceptance criteria format

Each `features/*.md` document carries its own detailed acceptance criteria and test scenarios in Given/When/Then form. This document tracks requirement *existence and MVP status*; the feature docs track requirement *correctness*.
