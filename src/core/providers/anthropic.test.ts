import { afterEach, describe, expect, test, vi } from "vitest";
import { AnthropicAdapter } from "./anthropic";

const config = { providerId: "anthropic", apiKey: "sk-ant-test", defaultModel: "claude-sonnet-5" };
const request = { systemPrompt: "You are a resume assistant.", userPrompt: "Rewrite this bullet.", model: "claude-sonnet-5" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("AnthropicAdapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("complete() maps a successful response, using the text content block", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        model: "claude-sonnet-5",
        content: [{ type: "text", text: "Delivered a 40% latency reduction using Docker." }],
        usage: { input_tokens: 30, output_tokens: 12 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new AnthropicAdapter();
    const result = await adapter.complete(request, config);

    expect(result.text).toBe("Delivered a 40% latency reduction using Docker.");
    expect(result.usage).toEqual({ promptTokens: 30, completionTokens: 12 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-test");
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe(request.systemPrompt);
    expect(body.max_tokens).toBeGreaterThan(0);
  });

  test("complete() throws a typed auth error on HTTP 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const adapter = new AnthropicAdapter();
    await expect(adapter.complete(request, config)).rejects.toMatchObject({ error: { kind: "auth" } });
  });
});
