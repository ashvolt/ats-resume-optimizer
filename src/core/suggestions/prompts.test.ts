import { describe, expect, test } from "vitest";
import type { Resume } from "../schema/resume";
import type { Suggestion } from "../schema/suggestion";
import { parseJd } from "../jd/parse";
import {
  addressableBullets,
  buildRefinementSystemPrompt,
  buildRefinementUserPrompt,
  buildSuggestionSystemPrompt,
  buildSuggestionUserPrompt,
} from "./prompts";

function baseResume(): Resume {
  const now = new Date().toISOString();
  return {
    id: "resume-1",
    schemaVersion: 1,
    meta: { name: "Ada Lovelace", contact: { email: "ada@example.com" } },
    sections: [
      {
        id: "s2",
        type: "experience",
        title: "Experience",
        entries: [
          {
            id: "e2",
            heading: "Senior Engineer, Acme Corp",
            bullets: [{ id: "b2", text: "Delivered a 40% latency reduction using Docker.", origin: "user" }],
          },
        ],
      },
      { id: "s3", type: "skills", title: "Skills", entries: [{ id: "e3", bullets: [{ id: "b4", text: "TypeScript, Docker", origin: "user" }] }] },
    ],
    markdownSource: "# Ada Lovelace",
    createdAt: now,
    updatedAt: now,
  };
}

describe("addressableBullets", () => {
  test("only surfaces experience/projects bullets, never skills/summary/education", () => {
    const refs = addressableBullets(baseResume());
    expect(refs).toEqual([{ bulletId: "b2", entryHeading: "Senior Engineer, Acme Corp", text: "Delivered a 40% latency reduction using Docker." }]);
  });
});

describe("suggestion generation prompts", () => {
  test("system prompt states the honesty constraint and includes the resume's actual content", () => {
    const resume = baseResume();
    const prompt = buildSuggestionSystemPrompt(resume);
    expect(prompt).toMatch(/never introduce a skill/i);
    // flattenResumeText lowercases everything, so match case-insensitively.
    expect(prompt.toLowerCase()).toContain("delivered a 40% latency reduction using docker.");
  });

  test("user prompt lists only real bullet ids and top missing keywords, never invents new ones", () => {
    const resume = baseResume();
    const jd = parseJd("Requirements\nKubernetes and Rust required.", { type: "paste" });
    const prompt = buildSuggestionUserPrompt(resume, jd, ["kubernetes", "rust"]);
    expect(prompt).toContain("b2");
    expect(prompt).toContain("kubernetes");
    expect(prompt).toMatch(/JSON array/);
  });
});

describe("refinement prompts", () => {
  const suggestion: Suggestion = {
    id: "sug-1",
    resumeEntryId: "b2",
    kind: "rewrite",
    original: "Delivered a 40% latency reduction using Docker.",
    proposed: "Cut latency by 40% by re-architecting the deployment pipeline with Docker.",
    reason: "Strengthened the claim with more concrete detail.",
    source: "ai",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  test("system prompt carries the same honesty constraint as generation", () => {
    const prompt = buildRefinementSystemPrompt(baseResume());
    expect(prompt).toMatch(/never introduce a skill/i);
  });

  test("user prompt includes both original and proposed text plus the requested action", () => {
    const prompt = buildRefinementUserPrompt(suggestion, "shorten");
    expect(prompt).toContain(suggestion.original);
    expect(prompt).toContain(suggestion.proposed);
    expect(prompt).toMatch(/shorten/i);
  });

  test("explain_reasoning instructs the model to leave the proposed text unchanged", () => {
    const prompt = buildRefinementUserPrompt(suggestion, "explain_reasoning");
    expect(prompt).toMatch(/do not change the proposed bullet text/i);
  });
});
