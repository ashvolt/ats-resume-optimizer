/**
 * Prompt construction for AI-sourced suggestions. This is the "prompt-construction layer" named
 * in docs/features/resume-editor.md as where FR-OPT-5 (never introduce a skill/tool/claim absent
 * from the source resume) is enforced for the suggestion engine specifically.
 */

import type { Resume } from "../schema/resume";
import type { JobDescription } from "../schema/job-description";
import type { Suggestion } from "../schema/suggestion";
import type { RefinementAction } from "./types";
import { flattenResumeText } from "../ats/flatten";
import { buildHonestySystemPrompt } from "../util/honesty-prompt";

export interface BulletRef {
  bulletId: string;
  entryHeading?: string;
  text: string;
}

/** Experience/project bullets, addressable by id — the only ids an AI suggestion may target. */
export function addressableBullets(resume: Resume): BulletRef[] {
  const refs: BulletRef[] = [];
  for (const section of resume.sections) {
    if (section.type !== "experience" && section.type !== "projects") continue;
    for (const entry of section.entries) {
      for (const bullet of entry.bullets) {
        refs.push({ bulletId: bullet.id, entryHeading: entry.heading, text: bullet.text });
      }
    }
  }
  return refs;
}

export function buildSuggestionSystemPrompt(resume: Resume): string {
  return buildHonestySystemPrompt(
    flattenResumeText(resume),
    "Propose rewordings of the candidate's existing resume bullets that better match a target job description.",
  );
}

export function buildSuggestionUserPrompt(
  resume: Resume,
  jd: JobDescription,
  missingKeywords: string[],
): string {
  const bullets = addressableBullets(resume);
  const topMissing = missingKeywords.slice(0, 10);

  return [
    `Job description role: ${jd.structured.role ?? "unspecified"}${jd.structured.company ? ` at ${jd.structured.company}` : ""}.`,
    topMissing.length > 0 ? `Top JD keywords the resume is currently missing: ${topMissing.join(", ")}.` : "",
    "",
    "Candidate's existing bullets (only these bulletIds may be targeted):",
    JSON.stringify(bullets.map(({ bulletId, text }) => ({ bulletId, text })), null, 2),
    "",
    "Propose up to 5 rewrites of the bullets most worth improving for this JD. Ground every rewrite in " +
      "what the bullet already says — you may rephrase, strengthen, or naturally mention a missing keyword " +
      "ONLY if the bullet's existing content genuinely supports it. Never invent a project, employer, or metric.",
    "",
    'Respond with ONLY a JSON array: [{ "bulletId": string, "proposed": string, "reason": string }]',
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export function buildRefinementSystemPrompt(resume: Resume): string {
  return buildHonestySystemPrompt(
    flattenResumeText(resume),
    "Revise a single previously-proposed resume bullet rewrite per the user's requested adjustment.",
  );
}

const REFINEMENT_INSTRUCTIONS: Record<RefinementAction, string> = {
  regenerate: "Produce a fresh alternative rewrite of the original bullet, different in phrasing from the previous proposal.",
  shorten: "Shorten the proposed bullet while keeping its meaning and any quantified impact.",
  expand: "Expand the proposed bullet with more concrete detail, without inventing anything not already implied by the original.",
  more_professional: "Rephrase the proposed bullet in a more formal, professional register.",
  more_ats_focused: "Rephrase the proposed bullet to foreground concrete keywords and skills an ATS keyword scan would pick up.",
  more_human: "Rephrase the proposed bullet so it reads more naturally, less like AI-generated boilerplate.",
  explain_reasoning: 'Do not change the proposed bullet text. Instead, use the "reason" field to explain why this rewrite improves on the original.',
};

export function buildRefinementUserPrompt(suggestion: Suggestion, action: RefinementAction): string {
  return [
    `Original resume bullet: "${suggestion.original}"`,
    `Previously proposed rewrite: "${suggestion.proposed}"`,
    `Requested adjustment: ${action} — ${REFINEMENT_INSTRUCTIONS[action]}`,
    "",
    'Respond with ONLY JSON: { "proposed": string, "reason": string }',
  ].join("\n");
}
