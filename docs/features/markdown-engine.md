# Feature: Markdown Rendering Pipeline

**Status:** Draft v1 · **Related:** [architecture.md §7](../architecture.md#7-markdown-pipeline)

## Problem statement

The vision requires the working resume to be stored as Markdown for git-friendliness, diffability, and ease of AI editing, while the editor and suggestion engine need structured data (sections/entries/bullets) to operate on. These two representations must never drift apart.

## User stories

- As a user, I can view a live Markdown preview of my resume at any point.
- As a user, I can edit either the structured form or the raw Markdown, and see the other stay in sync.
- As a user, I can diff any two versions of my resume and see exactly what changed.
- As a contributor, the Markdown structure is predictable enough that any tool (a linter, a static site generator, a different exporter) could consume it without reverse-engineering conventions.

## Functional requirements

See [requirements.md § FR-PREV](../requirements.md#preview--editing-fr-prev-featuresmarkdown-enginemd).

## Non-functional requirements

- Structured-edit → Markdown re-render and Markdown-edit → structure re-parse are both synchronous and fast enough for live preview (no perceptible lag while typing, debounced if needed).
- Round-trip stability: `parse(render(resume)) === resume` for any valid `Resume` (structural equality, not necessarily byte-identical whitespace).

## Design

`Resume.markdownSource` (architecture.md §3.1) is the canonical field. A fixed convention maps Resume JSON ⇄ Markdown:

```
# {meta.name}
{meta.title}
{contact line}

## {section.title}                  ← ResumeSection, in array order
### {entry.heading}                 ← ResumeEntry
{entry.subheading}
- {bullet.text}                     ← Bullet, one per line
- {bullet.text}
```

Two edit paths, one source of truth:

- **Structured edit** (accepting a suggestion, editing a field in the UI form) → the affected `ResumeSection`/`ResumeEntry`/`Bullet` updates → `markdownSource` is regenerated from the full structured tree.
- **Direct Markdown edit** (user typing in the Markdown pane) → re-parsed into `sections`/`entries`/`bullets` using the same heading-convention parser as [features/resume-import.md](resume-import.md)'s Markdown path → structured view updates.

Because both directions go through the same convention and the same parser/renderer pair, there's exactly one place this logic lives (`core/markdown/`), not two independently-maintained implementations that can drift.

## API contract

```ts
function renderMarkdown(resume: Resume): string;                    // structured → markdown, deterministic
function parseMarkdown(markdown: string): { resume: Resume; warnings: ParseWarning[] };  // markdown → structured

function diffVersions(a: ResumeVersion, b: ResumeVersion): VersionDiff;

interface VersionDiff {
  sectionsChanged: { sectionId: string; entriesAdded: number; entriesRemoved: number }[];
  bulletDiffs: { bulletId: string; before: string | null; after: string | null }[];  // null = added/removed
}
```

## UI flow

```
Editor
  ├─ Split pane: [Structured form] | [Markdown preview/edit]
  ├─ Edits on either side reflect on the other within one render cycle
  ├─ [Version history] → list of ResumeVersion snapshots, timestamps + trigger (suggestion vs manual)
  │     → select two versions → diff view (bulletDiffs rendered as inline +/- lines)
  └─ [Restore this version] → creates a new ResumeVersion equal to the selected snapshot (append, not overwrite — history is never destroyed)
```

## Acceptance criteria

- **Given** a structured edit (accepting a suggestion), **when** the Markdown pane is viewed, **then** it reflects the change immediately with correct heading/bullet formatting.
- **Given** a direct Markdown edit (e.g., adding a new bullet under an existing heading), **when** the structured form is viewed, **then** the new `Bullet` appears under the correct `ResumeEntry`.
- **Given** two versions in history, **when** diffed, **then** every changed, added, and removed bullet is individually identifiable.
- **Given** a restored prior version, **when** viewed in history, **then** both the original and the restored-copy versions remain visible — restoring never deletes history.

## Edge cases

- User edits Markdown in a way that breaks the heading convention (e.g., skips a heading level, adds a section with no `##`) — `parseMarkdown` must degrade gracefully (put orphaned content in an "Other" section with a `ParseWarning`) rather than throwing and losing the user's edit.
- Simultaneous edits in both panes within the same render cycle (fast typing while a structured update is also pending) — last-write-wins per field is acceptable for v1; flagged as a known simplification, not silently unspecified.
- Very long version history (many small accepted suggestions) — history list should paginate/virtualize rather than degrade UI performance; snapshot storage (§3.4 rationale: full snapshots, not diffs) trades storage size for simplicity and diff-on-demand rather than diff-to-reconstruct complexity.

## Future enhancements

- Configurable Markdown conventions (e.g., alternate heading levels) for compatibility with specific static-site/resume-template tooling.
- Collaborative/concurrent editing (explicitly out of v1 — no multi-user concept exists yet).

## Test scenarios

- Round-trip property test: generate random valid `Resume` structures, assert `parseMarkdown(renderMarkdown(r))` is structurally equal to `r`.
- Malformed-Markdown parser tests: skipped heading levels, orphaned bullets, empty sections — each produces a `ParseWarning`, none throws.
- Diff correctness tests: known before/after `ResumeVersion` pairs produce the expected `VersionDiff`.
