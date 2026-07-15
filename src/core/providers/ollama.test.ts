import { afterEach, describe, expect, test, vi } from "vitest";
import { OllamaAdapter } from "./ollama";
import { ProviderException } from "./errors";

const config = { providerId: "ollama", defaultModel: "llama3" };
const request = { systemPrompt: "You are a resume assistant.", userPrompt: "Rewrite this bullet.", model: "llama3" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("OllamaAdapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("requiresApiKey is false", () => {
    expect(new OllamaAdapter().requiresApiKey).toBe(false);
  });

  test("complete() maps a successful local response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          model: "llama3",
          message: { content: "Engineered a scalable pipeline." },
          prompt_eval_count: 20,
          eval_count: 8,
        }),
      ),
    );

    const adapter = new OllamaAdapter();
    const result = await adapter.complete(request, config);
    expect(result.text).toBe("Engineered a scalable pipeline.");
    expect(result.usage).toEqual({ promptTokens: 20, completionTokens: 8 });
  });

  test("connection refused (local server down) surfaces as a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const adapter = new OllamaAdapter();
    await expect(adapter.complete(request, config)).rejects.toBeInstanceOf(ProviderException);
    await expect(adapter.complete(request, config)).rejects.toMatchObject({ error: { kind: "network" } });
  });

  test("estimateCost is always null with a local-model basis", () => {
    const estimate = new OllamaAdapter().estimateCost();
    expect(estimate.estimatedUsd).toBeNull();
    expect(estimate.basis).toContain("Local");
  });
});
