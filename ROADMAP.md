# Roadmap

**Status:** Draft v1 · **Last updated:** 2026-07-15

This is the MVP definition and GitHub project structure for the rearchitecture. See [docs/vision.md](docs/vision.md) for why, [docs/architecture.md](docs/architecture.md) for how, [docs/requirements.md](docs/requirements.md) for the traceable requirement list, and [docs/features/future-roadmap.md](docs/features/future-roadmap.md) for everything explicitly deferred past v1.

## MVP definition (v1.0)

v1.0 ships when a user can, entirely client-side and with zero mandatory cost:

1. Import a JD (paste or scrape) and get it cleaned, section-weighted, and structured.
2. Import a resume (paste, Markdown, or PDF) into the Resume JSON source of truth.
3. Get a deterministic ATS score with a specific, actionable reason for every point lost — no AI required.
4. Optionally configure OpenAI, Anthropic, or Ollama and get AI-assisted rewrite suggestions layered on top.
5. Review every suggestion individually (accept/reject/refine) with a live-updating score and full version history.
6. Preview the resume as Markdown with a diff viewer across versions.
7. Export to Markdown or PDF.

Everything in [docs/requirements.md](docs/requirements.md) marked MVP: Yes is in scope; everything marked No, and everything in [docs/features/future-roadmap.md](docs/features/future-roadmap.md), is explicitly out.

## Milestones

| Milestone | Scope | Depends on |
|---|---|---|
| **M0 — Foundations** | Repo scaffolding: TypeScript setup, `core/` module skeleton, `Resume`/`JobDescription` schemas, `StorageAdapter` + IndexedDB, test harness | — |
| **M1 — Deterministic core** | Finish the JD/resume parsers and the deterministic ATS engine (tokenizer fix, section weighting, categorization, formatting-hazard checks) — the app is fully usable with zero AI at the end of this milestone | M0 |
| **M2 — Provider abstraction** | `ProviderAdapter` interface + OpenAI, Anthropic, Ollama adapters, credential storage/encryption, provider settings UI | M0 |
| **M3 — AI-assisted suggestions** | Suggestion engine, AI ATS layer, accept/reject/refine UI, version history, live re-score | M1, M2 |
| **M4 — Markdown & export** | Markdown pipeline (sync structured ⇄ Markdown), diff viewer, Markdown + PDF exporters | M1 (resume structure), M3 (versioning) |
| **M5 — Polish & release gate** | Accessibility pass (NFR-9), golden-set test coverage on `core/*`, security review of credential handling, docs review | M1–M4 |

M1 and M2 can run in parallel — they don't depend on each other, only on M0.

## Epics (GitHub Epic issues, one per feature doc)

- `EPIC: JD Import & Parsing` → [docs/features/jd-parser.md](docs/features/jd-parser.md)
- `EPIC: Resume Import` → [docs/features/resume-import.md](docs/features/resume-import.md)
- `EPIC: AI Provider Abstraction` → [docs/features/ai-provider.md](docs/features/ai-provider.md)
- `EPIC: ATS Analysis Engine` → [docs/features/ats-engine.md](docs/features/ats-engine.md)
- `EPIC: Suggestion Review & Editor` → [docs/features/resume-editor.md](docs/features/resume-editor.md)
- `EPIC: Markdown Pipeline` → [docs/features/markdown-engine.md](docs/features/markdown-engine.md)
- `EPIC: Export Pipeline` → [docs/features/export-engine.md](docs/features/export-engine.md)

Each Epic issue links its feature doc and is broken into Feature/Task issues tracing back to specific FR-/NFR- IDs in [docs/requirements.md](docs/requirements.md), so a closed issue is traceable to a specific requirement.

## Labels

| Label | Meaning |
|---|---|
| `epic` | Tracks a whole feature area (one per docs/features/*.md) |
| `task` | A concrete unit of work under an epic |
| `spec` | Documentation-only change (docs/, ADRs) |
| `mvp` | In v1 scope |
| `post-mvp` | Deferred — see future-roadmap.md |
| `good-first-issue` | Scoped for a new contributor — e.g., a new `ProviderAdapter` or `Exporter` |
| `needs-adr` | A change significant enough to require a new ADR before implementation |
| `bug` | Deviation from a documented acceptance criterion |
| `security` | Touches credential handling, storage encryption, or data locality (docs/architecture.md § Security and Privacy) |

## Contribution entry points (good-first-issue candidates)

Per [ADR-003](docs/decisions/ADR-003.md), the clearest low-risk contribution shape is a new `ProviderAdapter` (Gemini, Groq, OpenRouter, LM Studio, generic OpenAI-compatible) or a new `Exporter` (DOCX, LaTeX) — both are additive, interface-bounded, and don't require touching core scoring/suggestion logic. These should be the first issues opened once M2/M4 land the respective interfaces.

## Open process questions

- **Release cadence** — not yet decided; revisit once M0–M2 give a sense of real velocity.
- **CONTRIBUTING.md and issue templates** — not yet written; should land alongside or before the first `good-first-issue` is opened, not after.
