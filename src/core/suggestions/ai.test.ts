import { describe, expect, test, vi } from "vitest";
import type { Resume } from "../schema/resume";
import type { Suggestion } from "../schema/suggestion";
import type { CompletionResult, ProviderAdapter, ProviderConfig } from "../providers/types";
import { parseJd } from "../jd/parse";
import { scoreResume } from "../ats/score";
import { generateAiSuggestions, refineSuggestion } from "./ai";

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

const JD_TEXT = "Requirements\nKubernetes and Rust required. Docker required.";
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

describe("generateAiSuggestions", () => {
  test("maps a valid AI response into pending, source:ai Suggestion records", async () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const atsResult = scoreResume(resume, jd);
    const adapter = mockAdapter(
      JSON.stringify([{ bulletId: "b2", proposed: "Cut p99 latency 40% by re-architecting the Docker deployment.", reason: "More specific." }]),
    );

    const suggestions = await generateAiSuggestions(resume, jd, atsResult, adapter, config);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      resumeEntryId: "b2",
      kind: "rewrite",
      original: "Delivered a 40% latency reduction using Docker.",
      proposed: "Cut p99 latency 40% by re-architecting the Docker deployment.",
      source: "ai",
      status: "pending",
    });
  });

  test("drops items targeting a bulletId that doesn't exist on the resume", async () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const atsResult = scoreResume(resume, jd);
    const adapter = mockAdapter(JSON.stringify([{ bulletId: "does-not-exist", proposed: "Fabricated bullet.", reason: "x" }]));

    const suggestions = await generateAiSuggestions(resume, jd, atsResult, adapter, config);
    expect(suggestions).toHaveLength(0);
  });

  test("flags a curated tech term in the proposal that appears in neither resume nor JD", async () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const atsResult = scoreResume(resume, jd);
    const adapter = mockAdapter(
      JSON.stringify([{ bulletId: "b2", proposed: "Delivered a 40% latency reduction using Docker and Kubernetes.", reason: "Added scope." }]),
    );

    const suggestions = await generateAiSuggestions(resume, jd, atsResult, adapter, config);
    expect(suggestions[0]?.flaggedTerms).toBeUndefined();
    // Kubernetes IS in the JD text, so it should NOT be flagged (present in JD context).
  });

  test("flags a fabricated tech term absent from both resume and JD", async () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const atsResult = scoreResume(resume, jd);
    const adapter = mockAdapter(
      JSON.stringify([{ bulletId: "b2", proposed: "Delivered a 40% latency reduction using Docker and MongoDB.", reason: "x" }]),
    );

    const suggestions = await generateAiSuggestions(resume, jd, atsResult, adapter, config);
    expect(suggestions[0]?.flaggedTerms).toContain("mongodb");
  });

  test("throws when the AI response is not valid JSON", async () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const atsResult = scoreResume(resume, jd);
    const adapter = mockAdapter("not json at all");

    await expect(generateAiSuggestions(resume, jd, atsResult, adapter, config)).rejects.toThrow(/valid JSON/);
  });
});

describe("refineSuggestion", () => {
  const original: Suggestion = {
    id: "sug-1",
    resumeEntryId: "b2",
    kind: "rewrite",
    original: "Delivered a 40% latency reduction using Docker.",
    proposed: "Cut latency by 40% using Docker.",
    reason: "Tighter phrasing.",
    source: "ai",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  test("produces a new Suggestion record rather than mutating the original", async () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const adapter = mockAdapter(JSON.stringify({ proposed: "Cut p99 latency by 40% via Docker.", reason: "Added specificity." }));

    const refined = await refineSuggestion(original, "shorten", resume, jd, adapter, config);

    expect(refined.id).not.toBe(original.id);
    expect(refined.proposed).toBe("Cut p99 latency by 40% via Docker.");
    expect(refined.status).toBe("pending");
    expect(refined.source).toBe("ai");
    expect(original.status).toBe("pending"); // unmutated
  });

  test("explain_reasoning keeps the proposed text identical and only updates the reason", async () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const adapter = mockAdapter(JSON.stringify({ proposed: "ignored", reason: "Because it quantifies impact and names the tool." }));

    const refined = await refineSuggestion(original, "explain_reasoning", resume, jd, adapter, config);

    expect(refined.proposed).toBe(original.proposed);
    expect(refined.reason).toBe("Because it quantifies impact and names the tool.");
  });
});
