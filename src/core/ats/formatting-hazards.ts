/**
 * Structural formatting checks most ATS parsers mishandle. Operates on `markdownSource` since
 * that's where raw HTML/table syntax a user pasted or a PDF misparse would still be visible.
 * See docs/features/ats-engine.md § deterministic core, item 6.
 */

import type { Resume } from "../schema/resume";
import type { Deduction } from "./types";
import { generateId } from "../util/id";

const HTML_TAG_RE = /<\/?(table|tr|td|th|img|div|span)\b[^>]*>/i;
const PIPE_TABLE_RE = /^\s*\|.+\|\s*$\n\s*\|?[\s:|-]{3,}\|?\s*$/m;

export function detectFormattingHazards(resume: Resume): Deduction[] {
  const deductions: Deduction[] = [];
  const source = resume.markdownSource;

  if (HTML_TAG_RE.test(source)) {
    deductions.push({
      id: generateId("ded"),
      points: 10,
      reason: "Resume content contains raw HTML (e.g. a table or image tag), which most ATS parsers cannot read reliably.",
      recommendation: "Replace tables/embedded HTML with plain headings and bullet lists.",
      category: "formatting",
      source: "deterministic",
    });
  }

  if (PIPE_TABLE_RE.test(source)) {
    deductions.push({
      id: generateId("ded"),
      points: 10,
      reason: "Resume content contains a Markdown table, which renders as unreliable or scrambled text in most ATS parsers.",
      recommendation: "Convert tabular content (e.g. a skills matrix) into a plain comma-separated list.",
      category: "formatting",
      source: "deterministic",
    });
  }

  return deductions;
}
