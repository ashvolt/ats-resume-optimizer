/**
 * ATS engine contracts. Full design: docs/features/ats-engine.md. Implementation lands in M1/M3
 * (docs/ROADMAP.md) — this module currently defines the shared contract only.
 */

import type { KeywordCategory, Keyword } from "../schema/job-description";

export interface CategoryScore {
  category: KeywordCategory;
  present: Keyword[];
  missing: Keyword[];
}

export type DeductionCategory =
  | "keyword"
  | "section-completeness"
  | "action-verb"
  | "impact-metric"
  | "formatting"
  | "relevance" // AI-layer only
  | "phrasing"; // AI-layer only

export interface Deduction {
  id: string;
  points: number;
  reason: string;
  recommendation: string;
  category: DeductionCategory;
  source: "deterministic" | "ai";
}

export interface AtsScoreResult {
  score: number; // 0–100
  computedAt: string;
  breakdown: CategoryScore[];
  deductions: Deduction[];
  source: "deterministic" | "deterministic+ai";
}
