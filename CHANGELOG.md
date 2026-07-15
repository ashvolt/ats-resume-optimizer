# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Spec-driven development process adopted. `docs/` now holds the source of truth for vision, architecture, requirements, feature specs, and ADRs.
- `docs/decisions/ADR-001` through `ADR-007` recording the v1 rearchitecture decisions (runtime model, persistence, provider abstraction, ATS engine strategy, language, license, Google/Gmail push removal).
- Apache-2.0 `LICENSE`.
- **M0 foundations** ([ROADMAP.md](ROADMAP.md)): TypeScript tooling (`tsconfig.json`, strict mode), Vitest test harness (`vite.config.ts`, jsdom + fake-indexeddb), and the `src/core/` module skeleton — typed contracts for every interface named in `docs/architecture.md` §4 (`schema/`, `storage/`, `ats/`, `jd/`, `resume/`, `providers/`, `suggestions/`, `markdown/`, `export/`). `core/storage/` additionally ships a working `IndexedDbStorageAdapter` (backed by `idb`) implementing the full `StorageAdapter` interface, with tests.
- `tests/scraper.test.mjs` migrated from `node:test` to Vitest so there's one test runner going forward.
- `docs/diagrams/architecture.excalidraw` — editable system architecture diagram, linked from `docs/architecture.md` §1.
- **M1 deterministic core** ([ROADMAP.md](ROADMAP.md)): finished the tokenizer/section-weighting/keyword-classification design from `DEVELOPMENT_PLAN.md`, ported into `core/ats/` and `core/jd/` — sentence-aware tokenizer (with a fix for trailing sentence-punctuation surviving tokenization, e.g. `"required."`, and for `Node.js`-style tokens being split by the sentence-boundary regex itself), JD section parser/weighting, keyword extraction/classification, JD scraper (two-proxy fallback, blocked-host short-circuit for LinkedIn/Glassdoor/Workday), and `core/resume/` parsers for plain text, Markdown, and PDF (via `pdfjs-dist`) into the canonical Resume JSON. `core/ats/score.ts` implements `scoreResume` — deterministic, pure, every deduction traces to a named rule (keyword/section-completeness/action-verb/impact-metric/formatting).
- **M2 provider adapters** ([ROADMAP.md](ROADMAP.md)): `ProviderAdapter` implementations for OpenAI, Anthropic, and Ollama in `core/providers/`, plus a shared HTTP error taxonomy (`auth`/`rate_limit`/`timeout`/`model_not_found`/`content_filtered`/`network`) and a provider registry.

### Changed
- Project direction: from a Claude Artifact (browser sandbox, no independent hosting) to a standalone, backend-optional, local-first web application. See `docs/decisions/ADR-001.md`.

### Deprecated
- The `window.sendPrompt`-based Google Docs / Gmail push (Claude MCP handoff) is out of scope for v1. See `docs/decisions/ADR-002.md`. The existing implementation in `ats-resume-builder.jsx` still works standalone as a clipboard-copy fallback but will be removed once the v1 rearchitecture lands.
- `DEVELOPMENT_PLAN.md` and `FEATURES.md` (root-level) are superseded by `docs/architecture.md`, `docs/requirements.md`, and `docs/features/*.md`. Kept temporarily for historical reference — see the note at the top of each file.

## [0.1.0] — prototype

Initial prototype: single-file React component (`ats-resume-builder.jsx`), deterministic keyword-match ATS scoring, rule-based paraphrase engine, CORS-proxy JD scraping, Google Docs/Gmail push via Claude MCP (Artifact-only), manual `.docx` export script.
