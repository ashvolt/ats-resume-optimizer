/**
 * Weighted keyword extraction across JD sections. Requirements count 2x, Responsibilities 1.5x,
 * Preferred 0.5x; About/Benefits sections are expected to already be filtered out (weight 0)
 * before reaching this function — see docs/features/ats-engine.md § deterministic core, item 4.
 */

import type { JDSection, Keyword } from "../schema/job-description";
import { tokenFrequency } from "./tokenizer";
import { classifyKeyword } from "./classify";
import { JD_NOISE, TECH_TERMS } from "./constants";

const MAX_KEYWORDS = 60;

export function extractKeywords(sections: readonly JDSection[]): Keyword[] {
  const frequency: Record<string, number> = {};
  const weighted: Record<string, number> = {};

  for (const section of sections) {
    if (section.weight <= 0) continue;
    const freq = tokenFrequency(section.text);
    for (const [term, count] of Object.entries(freq)) {
      const head = term.split(" ")[0] ?? term;
      if (JD_NOISE.has(term) || JD_NOISE.has(head)) continue;
      if (/^\d+$/.test(term)) continue;
      if (term.length < 2) continue;
      // A single (non-bigram) word that isn't a known tech term needs 2+ raw occurrences to count —
      // filters incidental single mentions from noisy JD prose.
      if (!term.includes(" ") && !TECH_TERMS.has(term) && count < 2) continue;

      frequency[term] = (frequency[term] ?? 0) + count;
      weighted[term] = (weighted[term] ?? 0) + count * section.weight;
    }
  }

  return Object.entries(weighted)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORDS)
    .map(([term, weight]) => ({
      term,
      category: classifyKeyword(term),
      frequency: Math.round((frequency[term] ?? 0) * 10) / 10,
      weight: Math.round(weight * 10) / 10,
    }));
}
