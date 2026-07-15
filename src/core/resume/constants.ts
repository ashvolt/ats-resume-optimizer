import type { ResumeSectionType } from "../schema/resume";

/** Section-header detection patterns, ported + extended from ats-resume-builder.jsx. */
export const SECTION_PATTERNS: ReadonlyArray<{ type: ResumeSectionType; re: RegExp }> = [
  { type: "summary", re: /\b(summary|objective|about|profile|overview)\b/i },
  { type: "skills", re: /\b(skills|technologies|tech.?stack|competencies|expertise|technical)\b/i },
  { type: "experience", re: /\b(experience|employment|work.?history|career)\b/i },
  { type: "projects", re: /\b(projects?|portfolio|open.?source)\b/i },
  { type: "education", re: /\b(education|academic|degree|university|college)\b/i },
  { type: "certifications", re: /\b(certifications?|licenses?|credentials?)\b/i },
  { type: "achievements", re: /\b(achievements?|awards?|honou?rs?)\b/i },
];

export const BULLET_MARKER_RE = /^\s*[●•\-*]\s+/;

export function detectSectionHeader(line: string): ResumeSectionType | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 70) return null;
  for (const { type, re } of SECTION_PATTERNS) {
    if (re.test(trimmed)) return type;
  }
  return null;
}
