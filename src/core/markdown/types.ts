/**
 * Markdown pipeline contracts. Full design: docs/features/markdown-engine.md.
 * Implementation lands in M4 (docs/ROADMAP.md).
 */

import type { Resume } from "../schema/resume";
import type { ResumeVersion } from "../schema/suggestion";
import type { ParseWarning } from "../resume/types";

export interface VersionDiff {
  sectionsChanged: { sectionId: string; entriesAdded: number; entriesRemoved: number }[];
  bulletDiffs: { bulletId: string; before: string | null; after: string | null }[]; // null = added/removed
}

export type RenderMarkdown = (resume: Resume) => string;
export type ParseMarkdown = (markdown: string) => { resume: Resume; warnings: ParseWarning[] };
export type DiffVersions = (a: ResumeVersion, b: ResumeVersion) => VersionDiff;
