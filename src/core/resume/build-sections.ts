/**
 * Line-based section/entry/bullet builder shared by the plain-text and PDF parsers (PDF text
 * extraction reduces to the same line-oriented shape once pages are joined).
 * See docs/features/resume-import.md.
 */

import type { Bullet, ResumeEntry, ResumeSection } from "../schema/resume";
import type { ParseWarning } from "./types";
import { generateId } from "../util/id";
import { BULLET_MARKER_RE, detectSectionHeader } from "./constants";

export function buildSectionsFromLines(lines: readonly string[]): {
  sections: ResumeSection[];
  warnings: ParseWarning[];
} {
  const sections: ResumeSection[] = [];
  const warnings: ParseWarning[] = [];

  let current: ResumeSection = { id: generateId("sec"), type: "custom", title: "Other", entries: [] };
  let currentEntry: ResumeEntry | null = null;

  const flushEntry = () => {
    if (currentEntry && (currentEntry.heading || currentEntry.bullets.length > 0)) {
      current.entries.push(currentEntry);
    }
    currentEntry = null;
  };

  const flushSection = () => {
    flushEntry();
    if (current.entries.length > 0) sections.push(current);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headerType = detectSectionHeader(line);
    if (headerType) {
      flushSection();
      current = { id: generateId("sec"), type: headerType, title: line, entries: [] };
      continue;
    }

    if (BULLET_MARKER_RE.test(rawLine)) {
      const text = rawLine.replace(BULLET_MARKER_RE, "").trim();
      const bullet: Bullet = { id: generateId("bullet"), text, origin: "user" };
      if (!currentEntry) currentEntry = { id: generateId("entry"), bullets: [] };
      currentEntry.bullets.push(bullet);
      continue;
    }

    // Non-bullet content: first fills heading, then subheading, then starts a new entry.
    if (!currentEntry) {
      currentEntry = { id: generateId("entry"), heading: line, bullets: [] };
    } else if (!currentEntry.heading && currentEntry.bullets.length === 0) {
      currentEntry.heading = line;
    } else if (!currentEntry.subheading && currentEntry.bullets.length === 0) {
      currentEntry.subheading = line;
    } else {
      flushEntry();
      currentEntry = { id: generateId("entry"), heading: line, bullets: [] };
    }
  }
  flushSection();

  if (sections.every((s) => s.type === "custom")) {
    warnings.push({
      severity: "warning",
      message: "No resume sections could be confidently detected; content may need manual re-organization.",
    });
  }

  return { sections, warnings };
}
