import { describe, expect, test, vi } from "vitest";
import type { Resume } from "../schema/resume";
import type { CompletionResult, ProviderAdapter, ProviderConfig } from "../providers/types";
import { parseJd } from "../jd/parse";
import { scoreResume } from "./score";
import { scoreResumeWithAi } from "./ai-layer";

function baseResume(): Resume {
  const now = new Date().toISOString();
  return {
    id: "resume-1",
    schemaVersion: 1,
    meta: { name: "Ada Lovelace", contact: { email: "ada@example.com" } },
    sections: [
      { id: "s1", type: "summary", title: "Summary", entries: [{ id: "e1", bullets: [{ id: "b1", text: "Backend engineer.", origin: "user" }] }] },
      {
        id: "s2",
        type: "experience",
        title: "Experience",
        entries: [
          { id: "e2", heading: "Senior Engineer, Acme Corp", bullets: [{ id: "b2", text: "Built scalable APIs using TypeScript and Docker.", origin: "user" }] },
        ],
      },
      { id: "s3", type: "skills", title: "Skills", entries: [{ id: "e3", bullets: [{ id: "b4", text: "TypeScript, Docker", origin: "user" }] }] },
      { id: "s4", type: "education", title: "Education", entries: [{ id: "e4", heading: "BS Computer Science", bullets: [] }] },
    ],
    markdownSource: "# Ada Lovelace",
    createdAt: now,
    updatedAt: now,
  };
}

const JD_TEXT = "Requirements\nStrong TypeScript and Docker experience required.";
const config: ProviderConfig = { providerId: "mock", defaultModel: "mock-model" };

function mockAdapter(text: string): ProviderAdapter {
  const result: CompletionResult = { text, usage: { promptTokens: 10, completionTokens: 10 }, latencyMs: 5, model: "mock-model" };
  return {
    id: "mock",
    displayName: "Mock",
    requiresApiKey: false,
    listModels: async () => [],
    complete: vi.fn().mockResolvedValue(result),
    estimateCost: () => ({ estimatedUsd: null, basis: "mock" }),
  };
}

describe("scoreResumeWithAi", () => {
  test("merges AI findings onto the deterministic result without dropping any deterministic deduction", async () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const deterministic = scoreResume(resume, jd);
    const adapter = mockAdapter(
      JSON.stringify([{ category: "relevance", points: 3, reason: "Experience is startup-scale, JD wants enterprise-scale.", recommendation: "Emphasize scale where true." }]),
    );

    const result = await scoreResumeWithAi(resume, jd, adapter, config);

    // scoreResumeWithAi recomputes the deterministic pass itself (see ai-layer.ts doc comment),
    // so deduction ids differ from the standalone `deterministic` computed above — compare content.
    const withoutIds = (deductions: typeof deterministic.deductions) => deductions.map(({ id: _id, ...rest }) => rest);

    expect(result.source).toBe("deterministic+ai");
    expect(result.deductions.length).toBe(deterministic.deductions.length + 1);
    expect(withoutIds(result.deductions.filter((d) => d.source === "deterministic"))).toEqual(withoutIds(deterministic.deductions));
    const aiDeduction = result.deductions.find((d) => d.source === "ai");
    expect(aiDeduction?.category).toBe("relevance");
    expect(result.score).toBe(Math.max(0, deterministic.score - 3));
  });

  test("clamps out-of-range points and falls back to relevance for an unrecognized category", async () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const adapter = mockAdapter(JSON.stringify([{ category: "consistency", points: 999, reason: "x", recommendation: "y" }]));

    const result = await scoreResumeWithAi(resume, jd, adapter, config);
    const aiDeduction = result.deductions.find((d) => d.source === "ai");

    expect(aiDeduction?.category).toBe("relevance");
    expect(aiDeduction?.points).toBeLessThanOrEqual(5);
  });

  test("never lets the AI layer push the score below 0", async () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const findings = Array.from({ length: 6 }, () => ({ category: "phrasing", points: 5, reason: "x", recommendation: "y" }));
    const adapter = mockAdapter(JSON.stringify(findings));

    const result = await scoreResumeWithAi(resume, jd, adapter, config);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  test("throws when the AI response is not a JSON array, so callers can keep the deterministic result on screen", async () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const adapter = mockAdapter("{ not: an array }");

    await expect(scoreResumeWithAi(resume, jd, adapter, config)).rejects.toThrow();
  });
});
