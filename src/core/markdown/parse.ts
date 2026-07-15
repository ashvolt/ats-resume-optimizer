/**
 * Canonical Markdown -> Resume JSON. Mirrors render.ts's convention. Malformed input (an entry
 * heading with no section, a bullet with no entry) degrades into an "Other" section with a
 * warning rather than throwing — docs/features/markdown-engine.md § edge cases.
 */

import type { Bullet, Resume, ResumeContact, ResumeEntry, ResumeSection } from "../schema/resume";
import type { ParseWarning } from "../resume/types";
import { generateId } from "../util/id";
import { detectSectionHeader } from "../resume/constants";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;

function otherSection(): ResumeSection {
  return { id: generateId("sec"), type: "custom", title: "Other", entries: [] };
}

export function parseMarkdown(markdown: string): { resume: Resume; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const lines = markdown.split("\n");

  let name: string | undefined;
  let title: string | undefined;
  const contact: ResumeContact = {};
  const sections: ResumeSection[] = [];
  let current: ResumeSection | null = null;
  let currentEntry: ResumeEntry | null = null;
  let sawH1 = false;

  const flushEntry = () => {
    if (currentEntry && current) current.entries.push(currentEntry);
    currentEntry = null;
  };
  const flushSection = () => {
    flushEntry();
    if (current) sections.push(current);
  };
  const ensureSection = (warningMessage: string) => {
    if (!current) {
      warnings.push({ severity: "warning", message: warningMessage });
      current = otherSection();
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("# ")) {
      name = line.slice(2).trim();
      sawH1 = true;
      continue;
    }
    if (line.startsWith("## ")) {
      flushSection();
      const sectionTitle = line.slice(3).trim();
      current = { id: generateId("sec"), type: detectSectionHeader(sectionTitle) ?? "custom", title: sectionTitle, entries: [] };
      continue;
    }
    if (line.startsWith("### ")) {
      ensureSection(`Entry heading "${line}" appeared before any section heading.`);
      flushEntry();
      currentEntry = { id: generateId("entry"), heading: line.slice(4).trim(), bullets: [] };
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      ensureSection(`A bullet appeared before any section heading: "${line}".`);
      const text = line.replace(/^[-*]\s+/, "").trim();
      const bullet: Bullet = { id: generateId("bullet"), text, origin: "user" };
      if (!currentEntry) currentEntry = { id: generateId("entry"), bullets: [] };
      currentEntry.bullets.push(bullet);
      continue;
    }

    // Plain line, no markdown marker.
    if (!current) {
      if (!sawH1) {
        name = line;
        sawH1 = true;
      } else if (EMAIL_RE.test(line) || PHONE_RE.test(line)) {
        const email = line.match(EMAIL_RE)?.[0];
        const phone = line.match(PHONE_RE)?.[0]?.trim();
        if (email) contact.email = email;
        if (phone) contact.phone = phone;
      } else if (!title) {
        title = line;
      }
      continue;
    }
    if (currentEntry && !currentEntry.subheading && currentEntry.bullets.length === 0) {
      currentEntry.subheading = line;
    } else {
      flushEntry();
      currentEntry = { id: generateId("entry"), heading: line, bullets: [] };
    }
  }
  flushSection();

  const now = new Date().toISOString();
  const resume: Resume = {
    id: generateId("resume"),
    schemaVersion: 1,
    meta: { name: name ?? "Untitled Resume", title, contact },
    sections,
    markdownSource: markdown,
    createdAt: now,
    updatedAt: now,
  };

  return { resume, warnings };
}
