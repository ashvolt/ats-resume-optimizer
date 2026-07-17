/**
 * AI-sourced suggestion generation and refinement. See docs/features/resume-editor.md — every
 * `Suggestion` produced here has `source: "ai"` and must be individually reviewed, never
 * bulk-accepted (unlike deterministic.ts's output).
 *
 * Note on signatures: docs/features/resume-editor.md's API contract sketches
 * `refineSuggestion(suggestionId, action)` — an id-based lookup. This module instead takes the
 * `Suggestion`/`Resume`/`JobDescription` objects directly, matching the rest of core/ (scoreResume
 * takes a Resume, not an id): core stays a pure function of its inputs, and id resolution against
 * storage is the state/ layer's job, not core's.
 */

import type { Resume } from "../schema/resume";
import type { JobDescription } from "../schema/job-description";
import type { AtsScoreResult } from "../ats/types";
import type { ProviderAdapter, ProviderConfig } from "../providers/types";
import type { Suggestion } from "../schema/suggestion";
import type { RefinementAction } from "./types";
import { flattenResumeText } from "../ats/flatten";
import { TECH_TERMS } from "../ats/constants";
import { tokenizeSentences } from "../ats/tokenizer";
import { generateId } from "../util/id";
import {
  addressableBullets,
  buildRefinementSystemPrompt,
  buildRefinementUserPrompt,
  buildSuggestionSystemPrompt,
  buildSuggestionUserPrompt,
} from "./prompts";

const MAX_AI_SUGGESTIONS = 5;

interface RawSuggestionItem {
  bulletId: string;
  proposed: string;
  reason: string;
}

interface RawRefinement {
  proposed: string;
  reason: string;
}

function parseJsonResponse<T>(text: string, description: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`${description}: AI response was not valid JSON.`);
  }
}

/**
 * Curated tech terms present in `proposed` but absent from both the resume and the JD — the
 * honesty backstop from resume-editor.md's acceptance criteria: "a suggestion introduces a
 * keyword absent from the original resume ... flags it for extra scrutiny rather than presenting
 * it identically to a substantiated rewrite." Restricted to the curated TECH_TERMS whitelist
 * (rather than every novel word) so it flags real fabrication risk, not ordinary paraphrasing.
 */
function findUnsubstantiatedTechTerms(proposed: string, resume: Resume, jd: JobDescription): string[] {
  const proposedTerms = new Set(tokenizeSentences(proposed).flat());
  const groundTruth = `${flattenResumeText(resume)} ${jd.rawText}`.toLowerCase();
  return Array.from(proposedTerms).filter((term) => TECH_TERMS.has(term) && !groundTruth.includes(term));
}

export async function generateAiSuggestions(
  resume: Resume,
  jd: JobDescription,
  atsResult: AtsScoreResult,
  adapter: ProviderAdapter,
  config: ProviderConfig,
): Promise<Suggestion[]> {
  const bullets = addressableBullets(resume);
  if (bullets.length === 0) return [];

  const missingKeywords = atsResult.breakdown
    .filter((b) => b.category !== "general")
    .flatMap((b) => b.missing)
    .sort((a, b) => b.weight - a.weight)
    .map((k) => k.term);

  const request = {
    systemPrompt: buildSuggestionSystemPrompt(resume),
    userPrompt: buildSuggestionUserPrompt(resume, jd, missingKeywords),
    model: config.defaultModel,
    maxTokens: 1200,
    temperature: 0.4,
  };

  const result = await adapter.complete(request, config);
  const parsed = parseJsonResponse<RawSuggestionItem[]>(result.text, "Suggestion generation");
  if (!Array.isArray(parsed)) throw new Error("Suggestion generation: AI response was not a JSON array.");

  const bulletById = new Map(bullets.map((b) => [b.bulletId, b]));
  const now = new Date().toISOString();
  const suggestions: Suggestion[] = [];

  for (const item of parsed.slice(0, MAX_AI_SUGGESTIONS)) {
    const bullet = bulletById.get(item.bulletId);
    if (!bullet) continue; // model targeted an id we never offered — drop, never trust it
    if (typeof item.proposed !== "string" || item.proposed.trim().length === 0) continue;
    if (item.proposed === bullet.text) continue;

    const flaggedTerms = findUnsubstantiatedTechTerms(item.proposed, resume, jd);
    suggestions.push({
      id: generateId("sug"),
      resumeEntryId: bullet.bulletId,
      kind: "rewrite",
      original: bullet.text, // trusted from the resume itself, never from the model's echo
      proposed: item.proposed,
      reason: typeof item.reason === "string" && item.reason.trim() ? item.reason : "AI-suggested rewrite.",
      source: "ai",
      status: "pending",
      createdAt: now,
      ...(flaggedTerms.length > 0 ? { flaggedTerms } : {}),
    });
  }

  return suggestions;
}

export async function refineSuggestion(
  suggestion: Suggestion,
  action: RefinementAction,
  resume: Resume,
  jd: JobDescription,
  adapter: ProviderAdapter,
  config: ProviderConfig,
): Promise<Suggestion> {
  const request = {
    systemPrompt: buildRefinementSystemPrompt(resume),
    userPrompt: buildRefinementUserPrompt(suggestion, action),
    model: config.defaultModel,
    maxTokens: 600,
    temperature: 0.4,
  };

  const result = await adapter.complete(request, config);
  const parsed = parseJsonResponse<RawRefinement>(result.text, "Suggestion refinement");
  const proposed = action === "explain_reasoning" ? suggestion.proposed : parsed.proposed;
  if (typeof proposed !== "string" || proposed.trim().length === 0) {
    throw new Error("Suggestion refinement: AI response had no usable proposed text.");
  }

  const flaggedTerms = findUnsubstantiatedTechTerms(proposed, resume, jd);

  // A new Suggestion record, never a mutation of the original — preserves the audit trail per
  // resume-editor.md's refinement design.
  return {
    id: generateId("sug"),
    resumeEntryId: suggestion.resumeEntryId,
    kind: suggestion.kind,
    original: suggestion.original,
    proposed,
    reason: typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason : suggestion.reason,
    source: "ai",
    status: "pending",
    createdAt: new Date().toISOString(),
    ...(flaggedTerms.length > 0 ? { flaggedTerms } : {}),
  };
}
