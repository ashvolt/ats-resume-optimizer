import { afterEach, describe, expect, test, vi } from "vitest";
import { OpenAiAdapter } from "./openai";
import { ProviderException } from "./errors";

const config = { providerId: "openai", apiKey: "sk-test", defaultModel: "gpt-4o-mini" };
const request = { systemPrompt: "You are a resume assistant.", userPrompt: "Rewrite this bullet.", model: "gpt-4o-mini" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("OpenAiAdapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("complete() maps a successful response to CompletionResult", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          model: "gpt-4o-mini",
          choices: [{ message: { content: "Leveraged TypeScript to build scalable APIs." } }],
          usage: { prompt_tokens: 42, completion_tokens: 18 },
        }),
      ),
    );

    const adapter = new OpenAiAdapter();
    const result = await adapter.complete(request, config);

    expect(result.text).toBe("Leveraged TypeScript to build scalable APIs.");
    expect(result.usage).toEqual({ promptTokens: 42, completionTokens: 18 });
    expect(result.model).toBe("gpt-4o-mini");
  });

  test("complete() throws a typed auth error on HTTP 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"invalid key"}', { status: 401 })));

    const adapter = new OpenAiAdapter();
    await expect(adapter.complete(request, config)).rejects.toMatchObject({ error: { kind: "auth" } });
  });

  test("complete() throws a typed rate_limit error on HTTP 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));

    const adapter = new OpenAiAdapter();
    await expect(adapter.complete(request, config)).rejects.toMatchObject({ error: { kind: "rate_limit" } });
  });

  test("complete() wraps a connection failure as a network ProviderException", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );

    const adapter = new OpenAiAdapter();
    await expect(adapter.complete(request, config)).rejects.toBeInstanceOf(ProviderException);
  });

  test("estimateCost returns a positive estimate for a known model", () => {
    const adapter = new OpenAiAdapter();
    const estimate = adapter.estimateCost(request);
    expect(estimate.estimatedUsd).not.toBeNull();
    expect(estimate.estimatedUsd!).toBeGreaterThan(0);
  });

  test("estimateCost returns null for an unknown model", () => {
    const adapter = new OpenAiAdapter();
    const estimate = adapter.estimateCost({ ...request, model: "some-future-model" });
    expect(estimate.estimatedUsd).toBeNull();
  });
});
