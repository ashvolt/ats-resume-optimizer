# Vision

**Status:** Draft v1 · **Owner:** Project lead · **Last updated:** 2026-07-15

## Problem

Resumes get filtered by ATS software and by recruiters skimming for keywords before a human ever judges the candidate's actual fit. Job seekers don't fail because they're unqualified — they fail because their resume doesn't speak the JD's language. Fixing this today means manually re-reading the JD, manually re-reading the resume, and manually guessing what to change. It's slow, it's error-prone, and it tempts people into keyword-stuffing or fabricating experience, both of which backfire.

## What this project is

An AI-assisted resume optimization tool that:

1. Takes a Job Description and a resume, both normalized into structured data.
2. Scores ATS compatibility with a transparent, explainable engine — not a black-box number.
3. Proposes specific, reviewable edits that close real gaps, using the candidate's *actual* experience — never inventing new experience.
4. Lets the user accept, reject, or refine every suggestion individually, watching the score move as they go.
5. Exports a clean, ATS-safe resume in the format they need.

## What this project is not

- **Not an autofill machine.** It never silently rewrites a resume and hands back a fabricated result. Every change is a proposal until a human accepts it.
- **Not a job board or job matcher.** It optimizes one resume against one JD at a time; it does not search or rank jobs.
- **Not a hosted service that owns your data.** The default deployment is local-first: your resume, your JD, and your AI provider credentials live in your browser, not on our servers, because we don't run servers for your data. See [ADR-001](decisions/ADR-001.md) and [ADR-002](decisions/ADR-002.md).
- **Not locked to one AI vendor.** OpenAI, Anthropic, and local models (Ollama) are peers behind a common interface, not a primary provider with fallbacks bolted on. See [ADR-003](decisions/ADR-003.md).
- **Not dependent on AI to function at all.** The deterministic keyword/structure engine works with zero AI provider configured, for zero cost. AI is an enhancement layer, not a requirement. See [ADR-004](decisions/ADR-004.md).

## Design principles

These are load-bearing. Every feature decision should be checked against them, and any feature that violates one needs an explicit ADR justifying the exception.

| Principle | What it rules out |
|---|---|
| **Privacy-first** — user data and provider credentials stay on the user's device by default | Server-side resume storage, mandatory accounts, sending resume text to our infrastructure |
| **Model-agnostic** — no provider is a first-class citizen the others emulate | Provider-specific prompt formats leaking into core logic, hardcoded model names outside provider adapters |
| **Honest augmentation** — the AI improves the *expression* of real experience, never invents new experience | Auto-adding skills/tools the resume gives no evidence for, silent unreviewed edits |
| **Human-in-the-loop** — every AI-originated change is a diff the user explicitly approves | Auto-apply modes for AI suggestions (rule-based skills-section injection is exempt — see [ATS engine spec](features/ats-engine.md)) |
| **Cost-efficient** — the tool is useful with zero API spend | Any core flow (import → score → export) that requires a paid API call to complete |
| **Modular & extensible** — provider, parser, and export logic sit behind interfaces contributors can implement without touching core | Hardcoding a new provider/format by branching inside a shared function instead of adding a plugin |
| **Open-source friendly** — a new contributor can read `docs/` and understand the system without reading all the code | Undocumented behavior, tribal knowledge, decisions with no ADR |

## Who this is for (v1)

Individual job seekers optimizing their own resume against a specific JD, technically comfortable enough to paste an API key or run Ollama locally if they want AI features. Not yet: recruiters, teams, or non-technical users needing a zero-setup hosted product — that's a possible future direction (see [ROADMAP.md](../ROADMAP.md)), not a v1 constraint.

## Success looks like

- A user can go from "paste JD + upload resume" to "export an ATS-safe resume with an explained score improvement" without an AI key, and get a *better* result with one.
- A contributor can add a new AI provider or export format by implementing one interface, with no changes to core scoring or editing logic.
- Every score the tool shows has a "why" a user can read and act on — never just a number.

## Non-goals (see [ROADMAP.md](../ROADMAP.md) for the full future list)

Interview prep, cover letters, LinkedIn/portfolio optimization, job application tracking, team collaboration, analytics dashboards, browser extensions. These are plausible future directions explicitly deferred so v1 stays shippable.
