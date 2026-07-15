/**
 * Suggestion and version-history schema. Source of truth per docs/architecture.md §3.3-3.4.
 */

import type { Resume } from "./resume";
import type { AtsScoreResult } from "../ats/types";

export type SuggestionKind =
  | "rewrite"
  | "keyword-injection"
  | "verb-upgrade"
  | "section-add";

export type SuggestionSource = "deterministic" | "ai";

export type SuggestionStatus = "pending" | "accepted" | "rejected";

export interface Suggestion {
  id: string;
  resumeEntryId: string; // Bullet.id or ResumeEntry.id it targets
  kind: SuggestionKind;
  original: string;
  proposed: string;
  reason: string;
  source: SuggestionSource;
  status: SuggestionStatus;
  createdAt: string;
  resolvedAt?: string;
}

export type VersionTrigger =
  | { type: "suggestion"; suggestionId: string }
  | { type: "manual-edit" };

export interface ResumeVersion {
  id: string;
  resumeId: string;
  snapshot: Resume; // full snapshot, not a diff — see docs/architecture.md §3.4
  atsScore: AtsScoreResult;
  triggeredBy: VersionTrigger;
  createdAt: string;
}
