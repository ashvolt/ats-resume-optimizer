/**
 * Assembles the canonical JobDescription record from cleaned JD text.
 * Implements the `ParseJd` contract in ./types.ts — see docs/features/jd-parser.md.
 */

import type { JobDescription, JobDescriptionSource } from "../schema/job-description";
import { parseJdSections } from "./section-parser";
import { extractKeywords } from "../ats/extract-keywords";
import { detectLanguage } from "./language";
import { generateId } from "../util/id";

function guessRole(rawText: string): string | undefined {
  const firstLine = rawText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (firstLine && firstLine.length > 3 && firstLine.length < 80) return firstLine;
  return undefined;
}

export function parseJd(rawText: string, source: JobDescriptionSource): JobDescription {
  const sections = parseJdSections(rawText);
  return {
    id: generateId("jd"),
    schemaVersion: 1,
    source,
    rawText,
    language: detectLanguage(rawText),
    structured: {
      role: guessRole(rawText),
      sections,
    },
    keywords: extractKeywords(sections),
    createdAt: new Date().toISOString(),
  };
}
