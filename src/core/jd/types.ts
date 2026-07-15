/**
 * JD scraping/parsing contracts. Full design: docs/features/jd-parser.md.
 * Implementation lands in M1 (docs/ROADMAP.md) — carries forward the tokenizer/section-weighting
 * design from DEVELOPMENT_PLAN.md.
 */

import type { JobDescription, JobDescriptionSource } from "../schema/job-description";

export type JdScrapeError =
  | { kind: "blocked"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "empty_result"; message: string }
  | { kind: "network"; message: string };

export interface JdScraper {
  scrape(url: string, opts?: { timeoutMs?: number }): Promise<string>;
}

export type ParseJd = (rawText: string, source: JobDescriptionSource) => JobDescription;
