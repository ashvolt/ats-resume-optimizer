/**
 * Suggestion review/refinement contracts. Full design: docs/features/resume-editor.md.
 * Implementation lands in M3 (docs/ROADMAP.md).
 */

import type { ResumeVersion, Suggestion } from "../schema/suggestion";

export type RefinementAction =
  | "regenerate"
  | "shorten"
  | "expand"
  | "more_professional"
  | "more_ats_focused"
  | "more_human"
  | "explain_reasoning";

export type AcceptSuggestion = (suggestionId: string) => ResumeVersion; // mutates working Resume JSON, appends version
export type RejectSuggestion = (suggestionId: string) => void; // records rejection, no resume mutation
export type RefineSuggestion = (
  suggestionId: string,
  action: RefinementAction,
) => Promise<Suggestion>; // AI-only; produces a new Suggestion record
