/**
 * Accept/reject state transitions. See docs/features/resume-editor.md § "API contract" and
 * "Edge cases". Deviates from that doc's `acceptSuggestion(id): ResumeVersion` sketch in two ways,
 * both deliberate:
 *
 *  1. Takes explicit `Resume`/`JobDescription`/pending-suggestion objects instead of resolving ids
 *     itself — id resolution against storage belongs to the state/ layer (see ai.ts's note).
 *  2. Computes the re-score internally (via `scoreResume`) rather than leaving the caller to call
 *     it separately — this is what makes "accepting a suggestion triggers exactly one re-score,
 *     not zero or multiple" (resume-editor.md test scenario) true by construction instead of by
 *     caller discipline.
 */

import type { Resume, Bullet } from "../schema/resume";
import type { JobDescription } from "../schema/job-description";
import type { ResumeVersion, Suggestion } from "../schema/suggestion";
import type { StorageAdapter } from "../storage/types";
import { scoreResume } from "../ats/score";
import { generateId } from "../util/id";

export class StaleSuggestionError extends Error {
  constructor(public readonly suggestion: Suggestion) {
    super(
      `Suggestion ${suggestion.id} no longer matches the current resume text (it was likely edited or ` +
        `superseded) and was dropped rather than applied.`,
    );
    this.name = "StaleSuggestionError";
  }
}

export interface AcceptSuggestionResult {
  resume: Resume;
  version: ResumeVersion;
  /** Other pending suggestions targeting the same bullet, auto-invalidated by this accept. */
  invalidated: Suggestion[];
}

function findBullet(resume: Resume, bulletId: string): Bullet | undefined {
  for (const section of resume.sections) {
    for (const entry of section.entries) {
      const bullet = entry.bullets.find((b) => b.id === bulletId);
      if (bullet) return bullet;
    }
  }
  return undefined;
}

/** Pending suggestions whose `original` no longer matches the resume's current bullet text. */
export function findStaleSuggestions(resume: Resume, pendingSuggestions: Suggestion[]): Suggestion[] {
  return pendingSuggestions.filter((s) => {
    if (s.status !== "pending") return false;
    const bullet = findBullet(resume, s.resumeEntryId);
    return bullet === undefined || bullet.text !== s.original;
  });
}

/**
 * Applies an accepted suggestion to `resume`, appends a `ResumeVersion` snapshot with a fresh
 * score, and invalidates any other pending suggestion targeting the same bullet. Idempotent: a
 * suggestion that isn't `"pending"` (already accepted/rejected, e.g. from a double-click) is a
 * no-op — it returns the resume/score unchanged rather than re-applying.
 */
export async function acceptSuggestion(
  suggestion: Suggestion,
  resume: Resume,
  jd: JobDescription,
  pendingSuggestions: Suggestion[],
  storage: StorageAdapter,
): Promise<AcceptSuggestionResult | null> {
  if (suggestion.status !== "pending") return null;

  const targetBullet = findBullet(resume, suggestion.resumeEntryId);
  if (!targetBullet || targetBullet.text !== suggestion.original) {
    const stale: Suggestion = { ...suggestion, status: "rejected", resolvedAt: new Date().toISOString() };
    await storage.put("suggestions", stale);
    throw new StaleSuggestionError(suggestion);
  }

  const now = new Date().toISOString();
  const updatedResume: Resume = structuredClone(resume);
  updatedResume.updatedAt = now;

  outer: for (const section of updatedResume.sections) {
    for (const entry of section.entries) {
      const bullet = entry.bullets.find((b) => b.id === suggestion.resumeEntryId);
      if (bullet) {
        bullet.text = suggestion.proposed;
        bullet.origin = suggestion.source === "ai" ? "ai-accepted" : bullet.origin;
        break outer;
      }
    }
  }

  const atsScore = scoreResume(updatedResume, jd);
  const version: ResumeVersion = {
    id: generateId("ver"),
    resumeId: updatedResume.id,
    snapshot: updatedResume,
    atsScore,
    triggeredBy: { type: "suggestion", suggestionId: suggestion.id },
    createdAt: now,
  };

  const acceptedSuggestion: Suggestion = { ...suggestion, status: "accepted", resolvedAt: now };

  const invalidated = pendingSuggestions
    .filter((s) => s.id !== suggestion.id && s.status === "pending" && s.resumeEntryId === suggestion.resumeEntryId)
    .map((s) => ({ ...s, status: "rejected" as const, resolvedAt: now }));

  await storage.put("resumes", updatedResume);
  await storage.put("resumeVersions", version);
  await storage.put("suggestions", acceptedSuggestion);
  for (const s of invalidated) await storage.put("suggestions", s);

  return { resume: updatedResume, version, invalidated };
}

/** Idempotent: rejecting an already-resolved suggestion is a no-op. */
export async function rejectSuggestion(suggestion: Suggestion, storage: StorageAdapter): Promise<Suggestion> {
  if (suggestion.status !== "pending") return suggestion;
  const rejected: Suggestion = { ...suggestion, status: "rejected", resolvedAt: new Date().toISOString() };
  await storage.put("suggestions", rejected);
  return rejected;
}
