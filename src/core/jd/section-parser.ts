/**
 * JD section detection + weighting. Ported from ats-resume-builder.jsx's parseJDSections,
 * ADR-004 / docs/features/ats-engine.md § deterministic core, item 4.
 */

import type { JDSection } from "../schema/job-description";
import { SECTION_WEIGHTS } from "../ats/constants";

export function parseJdSections(jdText: string): JDSection[] {
  const lines = jdText.split("\n");
  const sections: JDSection[] = [];
  let current: JDSection = { label: "other", weight: 1.0, text: "" };

  for (const line of lines) {
    const match = line.trim().length < 80 ? SECTION_WEIGHTS.find(({ re }) => re.test(line)) : undefined;
    if (match) {
      if (current.text.trim()) sections.push(current);
      current = { label: match.label, weight: match.weight, text: "" };
    } else {
      current.text += " " + line;
    }
  }
  if (current.text.trim()) sections.push(current);

  // No headers detected at all — whole text is a single unclassified, full-weight section
  // rather than being silently dropped (docs/features/jd-parser.md § edge cases).
  if (sections.length === 0 && jdText.trim()) {
    return [{ label: "other", weight: 1.0, text: jdText }];
  }
  return sections;
}
