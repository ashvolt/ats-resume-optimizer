/**
 * Deterministic (rule-based) suggestion generation — no AI provider required. Grammatically safe
 * by construction, per docs/features/resume-editor.md's design section: keyword injection only
 * ever targets the Skills section (never fabricates an experience bullet), and verb upgrades only
 * ever substitute the leading weak verb this same regex already flags in ats/score.ts.
 */

import type { Resume } from "../schema/resume";
import type { AtsScoreResult } from "../ats/types";
import type { Suggestion } from "../schema/suggestion";
import { VERB_MAP } from "../ats/constants";
import { generateId } from "../util/id";

const MAX_KEYWORD_SUGGESTIONS = 8;

const WEAK_VERB_RE = new RegExp(
  `^(${Object.keys(VERB_MAP)
    .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`,
  "i",
);

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

function verbUpgradeSuggestions(resume: Resume): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const now = new Date().toISOString();

  for (const section of resume.sections) {
    for (const entry of section.entries) {
      for (const bullet of entry.bullets) {
        const trimmed = bullet.text.trim();
        const match = trimmed.match(WEAK_VERB_RE);
        if (!match) continue;

        const weakVerb = match[1]!.toLowerCase();
        const upgrade = VERB_MAP[weakVerb];
        if (!upgrade) continue;

        const proposed = `${capitalize(upgrade)}${trimmed.slice(match[0].length)}`;
        if (proposed === bullet.text) continue;

        suggestions.push({
          id: generateId("sug"),
          resumeEntryId: bullet.id,
          kind: "verb-upgrade",
          original: bullet.text,
          proposed,
          reason: `Weak opening verb "${weakVerb}" replaced with a stronger action verb ("${upgrade}").`,
          source: "deterministic",
          status: "pending",
          createdAt: now,
        });
      }
    }
  }

  return suggestions;
}

/** Only ever targets the Skills section's first entry/bullet — see module doc comment. */
function keywordInjectionSuggestions(resume: Resume, atsResult: AtsScoreResult): Suggestion[] {
  const skillsBullet = resume.sections.find((s) => s.type === "skills")?.entries[0]?.bullets[0];
  if (!skillsBullet) return [];

  const now = new Date().toISOString();
  const missing = atsResult.breakdown
    .filter((b) => b.category !== "general")
    .flatMap((b) => b.missing)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_KEYWORD_SUGGESTIONS);

  return missing.map((keyword) => ({
    id: generateId("sug"),
    resumeEntryId: skillsBullet.id,
    kind: "keyword-injection" as const,
    original: skillsBullet.text,
    proposed: `${skillsBullet.text}, ${keyword.term}`,
    reason: `"${keyword.term}" (${keyword.category}) appears in the job description but not on your resume. Added to Skills.`,
    source: "deterministic" as const,
    status: "pending" as const,
    createdAt: now,
  }));
}

/**
 * Both suggestion kinds may target the same bullet (e.g. a skills-list keyword injection and a
 * separate verb-upgrade on an unrelated bullet, or two missing keywords both proposed against the
 * same Skills bullet) — that's expected; `suggestions/state.ts`'s acceptSuggestion invalidates
 * same-target siblings on accept rather than requiring generation to dedupe up front.
 */
export function generateDeterministicSuggestions(resume: Resume, atsResult: AtsScoreResult): Suggestion[] {
  return [...keywordInjectionSuggestions(resume, atsResult), ...verbUpgradeSuggestions(resume)];
}
