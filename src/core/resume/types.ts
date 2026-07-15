/**
 * Resume parser contracts. Full design: docs/features/resume-import.md.
 * Implementation (PDF/Markdown/text parsers) lands in M1 (docs/ROADMAP.md).
 */

import type { Resume } from "../schema/resume";

export interface ParseWarning {
  severity: "info" | "warning";
  message: string;
  affectedSectionId?: string;
}

export interface ParseResult {
  resume: Resume;
  warnings: ParseWarning[];
}

export interface ResumeParser {
  readonly acceptedTypes: string[]; // MIME types or extensions this parser handles
  parse(input: File | string): Promise<ParseResult>;
}
