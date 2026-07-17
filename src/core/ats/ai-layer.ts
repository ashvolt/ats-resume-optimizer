/**
 * Optional AI layer, gated on a configured provider — extends the deterministic score with
 * relevance/phrasing findings the rule engine can't produce on its own. See
 * docs/features/ats-engine.md § "Design: AI layer" and ADR-004: additive only, never mutates or
 * hides a deterministic finding.
 */

import type { Resume } from "../schema/resume";
import type { JobDescription } from "../schema/job-description";
import type { ProviderAdapter, ProviderConfig } from "../providers/types";
import type { AtsScoreResult, Deduction, DeductionCategory } from "./types";
import { scoreResume } from "./score";
import { flattenResumeText } from "./flatten";
import { generateId } from "../util/id";
import { buildHonestySystemPrompt } from "../util/honesty-prompt";

const MAX_FINDINGS = 6;
const MAX_POINTS_PER_FINDING = 5;
const AI_CATEGORIES: ReadonlySet<DeductionCategory> = new Set(["relevance", "phrasing"]);

interface AiFinding {
  category: string;
  points?: number;
  reason: string;
  recommendation: string;
}

function buildAiAtsSystemPrompt(resume: Resume): string {
  return buildHonestySystemPrompt(
    flattenResumeText(resume),
    "Evaluate how well this resume's *content* (not just keyword overlap) matches a target job " +
      "description, and flag any implausible or contradictory claims.",
  );
}

function buildAiAtsUserPrompt(jd: JobDescription, deterministic: AtsScoreResult): string {
  const topDeductions = deterministic.deductions
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, 8)
    .map((d) => `- [${d.category}] ${d.reason}`);

  return [
    `Job description role: ${jd.structured.role ?? "unspecified"}${jd.structured.company ? ` at ${jd.structured.company}` : ""}.`,
    "",
    "Job description text:",
    '"""',
    jd.rawText.slice(0, 4000),
    '"""',
    "",
    `Deterministic keyword-coverage score already computed: ${deterministic.score}/100. Deductions already` +
      " found by the rule engine (do not repeat these, add findings the rules can't see):",
    topDeductions.length > 0 ? topDeductions.join("\n") : "(none)",
    "",
    "Assess: (1) relevance — does the experience's actual seniority/domain match the role, beyond keyword " +
      "overlap; (2) phrasing — are claims specific and substantiated or vague even with the right verb; " +
      "(3) consistency — any contradictory or implausible claims (e.g. a skill claimed before it existed). " +
      `Return up to ${MAX_FINDINGS} findings, each worth at most ${MAX_POINTS_PER_FINDING} points.`,
    "",
    'Respond with ONLY a JSON array: [{ "category": "relevance" | "phrasing", "points": number, "reason": string, "recommendation": string }]',
  ].join("\n");
}

function parseFindings(text: string): AiFinding[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI ATS layer returned a response that was not valid JSON.");
  }
  if (!Array.isArray(parsed)) throw new Error("AI ATS layer response was not a JSON array.");
  return parsed as AiFinding[];
}

/**
 * Extends `scoreResume`'s deterministic result with an AI-sourced relevance/phrasing pass.
 * Runs the deterministic pass internally so callers always get a complete result from one call;
 * if the AI call fails (network/parse/timeout), it throws — callers must keep displaying the
 * already-available deterministic result and surface the AI failure separately (ats-engine.md
 * edge case: "AI layer times out or errors ... deterministic result must already be displayed").
 */
export async function scoreResumeWithAi(
  resume: Resume,
  jd: JobDescription,
  adapter: ProviderAdapter,
  config: ProviderConfig,
): Promise<AtsScoreResult> {
  const deterministic = scoreResume(resume, jd);

  const request = {
    systemPrompt: buildAiAtsSystemPrompt(resume),
    userPrompt: buildAiAtsUserPrompt(jd, deterministic),
    model: config.defaultModel,
    maxTokens: 1000,
    temperature: 0.3,
  };
  const result = await adapter.complete(request, config);
  const findings = parseFindings(result.text).slice(0, MAX_FINDINGS);

  const aiDeductions: Deduction[] = findings.map((f) => ({
    id: generateId("ded"),
    points: Math.max(0, Math.min(MAX_POINTS_PER_FINDING, typeof f.points === "number" ? f.points : 0)),
    reason: f.reason,
    recommendation: f.recommendation,
    category: AI_CATEGORIES.has(f.category as DeductionCategory) ? (f.category as DeductionCategory) : "relevance",
    source: "ai",
  }));

  const aiPenalty = aiDeductions.reduce((sum, d) => sum + d.points, 0);

  return {
    score: Math.max(0, Math.min(100, Math.round(deterministic.score - aiPenalty))),
    computedAt: new Date().toISOString(),
    breakdown: deterministic.breakdown,
    deductions: [...deterministic.deductions, ...aiDeductions],
    source: "deterministic+ai",
  };
}
