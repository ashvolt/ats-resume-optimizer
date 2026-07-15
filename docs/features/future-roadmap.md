# Future Roadmap (Post-v1)

**Status:** Draft v1 · **Related:** [ROADMAP.md](../../ROADMAP.md) for milestone sequencing

This document is an index of explicitly deferred ideas from the original project brief. None of these are speced to build-readiness — that happens if/when one is promoted to its own `docs/features/*.md` with the full Problem/Stories/Requirements/Acceptance-criteria structure. Listing them here does two things: keeps them from being silently forgotten, and keeps them out of v1 scope creep.

| Idea | One-line shape | Why deferred |
|---|---|---|
| AI interview preparation | Generate likely interview questions from the optimized resume + JD | Net-new domain (interview coaching), not a resume-optimization extension — needs its own problem statement and UX, not a bolt-on |
| Cover letter generation | Reuse Resume JSON + JD JSON to draft a cover letter | Reasonable near-future extension of the existing data model; deferred only to keep v1 scope to the resume loop |
| LinkedIn profile optimization | Score/suggest edits to a LinkedIn profile similarly to a resume | Needs a LinkedIn content model and likely auth/scraping considerations distinct from resume/JD |
| Portfolio optimization | Similar treatment for a portfolio site/README | Same shape as LinkedIn optimization; same reasons deferred |
| Job application tracking | Track which JDs were applied to, with which resume version, and outcome | A genuinely different feature (a tracker, not an optimizer) — worth its own spec, not a checkbox on this one |
| Multiple resume templates | Visual template selection at export time | Depends on [features/export-engine.md](export-engine.md)'s `Exporter` plugin system landing first — templates are exporters, sequenced after the interface exists |
| Team collaboration | Shared resumes/feedback across multiple users | Directly conflicts with [ADR-002](../decisions/ADR-002.md)'s local-first, no-account v1 model — needs a real sync/backend design first |
| Analytics dashboard | Aggregate stats across a user's resume history | Low priority without multi-resume/multi-JD UI (see [architecture.md open question 4](../architecture.md#13-open-questions-and-assumptions)) landing first |
| AI model benchmarking | Compare providers/models on the same prompt | Natural extension of [features/ai-provider.md](ai-provider.md)'s adapter abstraction once more than 3 providers exist |
| Additional local LLM support (LM Studio, generic OpenAI-compatible) | New `ProviderAdapter` implementations | Explicitly sequenced as the first post-v1 provider additions per [ADR-003](../decisions/ADR-003.md) |
| Browser extension for one-click JD import | Read the JD directly from the page the user's already on | Would remove the CORS-proxy dependency in [features/jd-parser.md](jd-parser.md) entirely — attractive, but a distinct packaging/distribution effort (extension store review, manifest permissions) |
| Chrome extension for job applications | Broader in-page automation | Larger scope than JD import alone; revisit only after the JD-import extension proves the model |
| Multi-language resume optimization | Full optimization support (not just detection) for non-English resumes/JDs | Current deterministic heuristics (tokenizer, section patterns, verb maps) are English-pattern-tuned; real multi-language support is a substantial redesign of the deterministic core, not a config flag |
| Google Docs / Gmail push | Native OAuth re-implementation of the v0.1 Claude-MCP-based feature | Deferred per [ADR-007](../decisions/ADR-007.md) pending appetite for Google's OAuth app-verification process |
| DOCX / LaTeX export | Additional `Exporter` implementations | Sequenced after PDF/Markdown exporters prove the plugin interface, per [features/export-engine.md](export-engine.md) |
| Self-hosted sync backend | Optional multi-device sync implementing the `StorageAdapter` interface server-side | The seam is intentionally left open in [ADR-002](../decisions/ADR-002.md); not designed until there's real demand |
