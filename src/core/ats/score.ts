/**
 * Deterministic ATS scoring — pure function of (Resume, JobDescription), no AI/network involved.
 * See ADR-004 and docs/features/ats-engine.md. Score = keyword coverage, reduced by structural
 * penalties (missing sections, weak verbs, unquantified impact, formatting hazards) — every point
 * lost traces to a specific, listed Deduction (NFR-4, FR-ATS-3/4).
 */

import type { Resume, ResumeSectionType } from "../schema/resume";
import type { JobDescription, KeywordCategory } from "../schema/job-description";
import type { AtsScoreResult, CategoryScore, Deduction } from "./types";
import { allBullets, flattenResumeText, presentSectionTypes } from "./flatten";
import { detectFormattingHazards } from "./formatting-hazards";
import { VERB_MAP } from "./constants";
import { generateId } from "../util/id";

const EXPECTED_SECTIONS: ResumeSectionType[] = ["summary", "experience", "skills", "education"];
const CATEGORIES: KeywordCategory[] = ["language", "framework", "database", "cloud", "tool", "methodology", "general"];

const WEAK_VERB_RE = new RegExp(
  `^(${Object.keys(VERB_MAP)
    .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`,
  "i",
);
const HAS_METRIC_RE = /\d/;

/**
 * A bigram counts as present if both of its words appear anywhere in the resume — requiring
 * exact adjacency ("typescript kubernetes") would miss "TypeScript and Kubernetes" or
 * "TypeScript, Kubernetes" purely on punctuation/conjunctions, which says nothing about whether
 * the candidate actually has both skills.
 */
function isKeywordPresent(term: string, resumeText: string): boolean {
  if (!term.includes(" ")) return resumeText.includes(term);
  return term.split(" ").every((word) => resumeText.includes(word));
}

function keywordDeductions(jd: JobDescription, resumeText: string): { deductions: Deduction[]; breakdown: CategoryScore[]; matchedWeight: number; totalWeight: number } {
  const breakdown: CategoryScore[] = CATEGORIES.map((category) => ({ category, present: [], missing: [] }));
  const byCategory = new Map(breakdown.map((b) => [b.category, b]));

  const totalWeight = jd.keywords.reduce((sum, k) => sum + k.weight, 0);
  let matchedWeight = 0;
  const deductions: Deduction[] = [];

  for (const keyword of jd.keywords) {
    const isPresent = isKeywordPresent(keyword.term, resumeText);
    const bucket = byCategory.get(keyword.category);
    if (isPresent) {
      matchedWeight += keyword.weight;
      bucket?.present.push(keyword);
      continue;
    }

    bucket?.missing.push(keyword);
    const sectionNote =
      jd.structured.sections.find((s) => s.text.toLowerCase().includes(keyword.term))?.label ?? "requirements";
    deductions.push({
      id: generateId("ded"),
      // Each missing keyword's points are its share of total JD keyword weight, so
      // sum(keyword deduction points) equals the coverage gap the headline score reflects —
      // the "why" list stays internally consistent with the score (docs/features/ats-engine.md).
      points: totalWeight > 0 ? Math.round((keyword.weight / totalWeight) * 1000) / 10 : 0,
      reason: `Missing keyword: "${keyword.term}" (appears ${keyword.frequency}x weighted, in ${sectionNote})`,
      recommendation: `Add "${keyword.term}" to your Skills section or a relevant experience bullet, if it genuinely reflects your background.`,
      category: "keyword",
      source: "deterministic",
    });
  }

  if (jd.keywords.length < 3 || totalWeight === 0) {
    deductions.unshift({
      id: generateId("ded"),
      points: 0,
      reason: "This job description is too short or too generic to extract a reliable keyword set.",
      recommendation: "Paste the full job posting, including the Requirements/Responsibilities sections, for a more accurate score.",
      category: "keyword",
      source: "deterministic",
    });
  }

  return { deductions, breakdown, matchedWeight, totalWeight };
}

function sectionCompletenessDeductions(resume: Resume): Deduction[] {
  const present = presentSectionTypes(resume);
  return EXPECTED_SECTIONS.filter((type) => !present.has(type)).map((type) => ({
    id: generateId("ded"),
    points: 5,
    reason: `No ${type} section was detected.`,
    recommendation: `Add a clearly labeled ${type} section — ATS parsers and recruiters both expect it.`,
    category: "section-completeness" as const,
    source: "deterministic" as const,
  }));
}

function actionVerbDeduction(resume: Resume): Deduction | null {
  const weak = allBullets(resume).filter((b) => WEAK_VERB_RE.test(b.text.trim()));
  if (weak.length === 0) return null;
  const example = weak[0]?.text.slice(0, 60) ?? "";
  return {
    id: generateId("ded"),
    points: Math.min(10, weak.length * 2),
    reason: `${weak.length} bullet(s) open with a weak verb (e.g. "${example}").`,
    recommendation: 'Replace weak openers ("used", "worked on", "responsible for") with stronger action verbs ("leveraged", "delivered", "owned").',
    category: "action-verb",
    source: "deterministic",
  };
}

function impactMetricDeduction(resume: Resume): Deduction | null {
  const unquantified = allBullets(resume).filter((b) => !HAS_METRIC_RE.test(b.text));
  if (unquantified.length === 0) return null;
  return {
    id: generateId("ded"),
    points: Math.min(10, unquantified.length),
    reason: `${unquantified.length} bullet(s) have no quantified impact (no numbers or percentages).`,
    recommendation: "Where accurate, quantify impact — \"reduced latency by 30%\", \"led a team of 5\", \"cut build time from 12m to 4m\".",
    category: "impact-metric",
    source: "deterministic",
  };
}

export function scoreResume(resume: Resume, jd: JobDescription): AtsScoreResult {
  const resumeText = flattenResumeText(resume);
  const { deductions: kwDeductions, breakdown, matchedWeight, totalWeight } = keywordDeductions(jd, resumeText);

  const structural = [
    ...sectionCompletenessDeductions(resume),
    ...[actionVerbDeduction(resume), impactMetricDeduction(resume)].filter((d): d is Deduction => d !== null),
    ...detectFormattingHazards(resume),
  ];

  const keywordCoverage = totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 100;
  const structuralPenalty = structural.reduce((sum, d) => sum + d.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(keywordCoverage - structuralPenalty)));

  return {
    score,
    computedAt: new Date().toISOString(),
    breakdown,
    deductions: [...kwDeductions, ...structural],
    source: "deterministic",
  };
}
