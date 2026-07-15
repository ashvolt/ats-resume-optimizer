/** Anthropic adapter — distinct shape from OpenAI: separate `system` field, `x-api-key` header. */

import type {
  CompletionRequest,
  CompletionResult,
  CostEstimate,
  ModelInfo,
  ProviderAdapter,
  ProviderConfig,
} from "./types";
import { ProviderException, httpStatusToProviderError, withTimeout } from "./errors";

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 1024; // Anthropic requires max_tokens on every request, unlike OpenAI

const PRICING: Readonly<Record<string, { inputPer1k: number; outputPer1k: number }>> = {
  "claude-sonnet-5": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-haiku-4-5-20251001": { inputPer1k: 0.001, outputPer1k: 0.005 },
};

interface AnthropicMessageResponse {
  model: string;
  content: { type: string; text?: string }[];
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicModelsResponse {
  data: { id: string; display_name?: string }[];
}

function authHeaders(config: ProviderConfig): Record<string, string> {
  return {
    "x-api-key": config.apiKey ?? "",
    "anthropic-version": ANTHROPIC_VERSION,
    "Content-Type": "application/json",
  };
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly id = "anthropic";
  readonly displayName = "Anthropic";
  readonly requiresApiKey = true;

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    return withTimeout(async (signal) => {
      const resp = await fetch(`${config.baseUrl ?? DEFAULT_BASE_URL}/models`, {
        headers: authHeaders(config),
        signal,
      });
      const text = await resp.text();
      if (!resp.ok) throw new ProviderException(httpStatusToProviderError(resp.status, text));
      const data = JSON.parse(text) as AnthropicModelsResponse;
      return data.data.map((m) => ({ id: m.id, displayName: m.display_name ?? m.id }));
    }, DEFAULT_TIMEOUT_MS);
  }

  async complete(request: CompletionRequest, config: ProviderConfig): Promise<CompletionResult> {
    return withTimeout(async (signal) => {
      const start = Date.now();
      const resp = await fetch(`${config.baseUrl ?? DEFAULT_BASE_URL}/messages`, {
        method: "POST",
        headers: authHeaders(config),
        body: JSON.stringify({
          model: request.model,
          system: request.systemPrompt,
          messages: [{ role: "user", content: request.userPrompt }],
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        }),
        signal,
      });
      const text = await resp.text();
      if (!resp.ok) throw new ProviderException(httpStatusToProviderError(resp.status, text));

      const data = JSON.parse(text) as AnthropicMessageResponse;
      const textBlock = data.content.find((c) => c.type === "text");
      return {
        text: textBlock?.text ?? "",
        usage: { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens },
        latencyMs: Date.now() - start,
        model: data.model,
        raw: data,
      };
    }, DEFAULT_TIMEOUT_MS);
  }

  estimateCost(request: CompletionRequest): CostEstimate {
    const pricing = PRICING[request.model];
    if (!pricing) return { estimatedUsd: null, basis: `No known pricing for model "${request.model}".` };

    const promptTokens = Math.ceil((request.systemPrompt.length + request.userPrompt.length) / 4);
    const outputTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS;
    const estimatedUsd = (promptTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;

    return {
      estimatedUsd: Math.round(estimatedUsd * 10000) / 10000,
      basis: `${request.model}: $${pricing.inputPer1k}/1K in, $${pricing.outputPer1k}/1K out (est.)`,
    };
  }
}
