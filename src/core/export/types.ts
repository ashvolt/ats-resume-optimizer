/**
 * Export pipeline contract. Full design: docs/features/export-engine.md.
 * Reference implementations (Markdown, PDF) land in M4 (docs/ROADMAP.md).
 */

import type { Resume } from "../schema/resume";

export interface Exporter {
  readonly format: string; // "markdown" | "pdf" | future: "docx" | "latex"
  readonly displayName: string;
  export(resume: Resume): Promise<Blob>;
}
