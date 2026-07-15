/** OpenAI adapter — also the request/response shape most "OpenAI-compatible" endpoints share. */

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
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/** Illustrative pricing snapshot — real pricing should be kept current, not load-bearing for correctness. */
const PRICING: Readonly<Record<string, { inputPer1k: number; outputPer1k: number }>> = {
  "gpt-4o": { inputPer1k: 0.005, outputPer1k: 0.015 },
  "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
};

interface OpenAiChatResponse {
  model: string;
  choices: { message: { content: string } }[];
  usage: { prompt_tokens: number; completion_tokens: number };
}

interface OpenAiModelsResponse {
  data: { id: string }[];
}

export class OpenAiAdapter implements ProviderAdapter {
  readonly id = "openai";
  readonly displayName = "OpenAI";
  readonly requiresApiKey = true;

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    return withTimeout(async (signal) => {
      const resp = await fetch(`${config.baseUrl ?? DEFAULT_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey ?? ""}` },
        signal,
      });
      const text = await resp.text();
      if (!resp.ok) throw new ProviderException(httpStatusToProviderError(resp.status, text));
      const data = JSON.parse(text) as OpenAiModelsResponse;
      return data.data.map((m) => ({ id: m.id, displayName: m.id }));
    }, DEFAULT_TIMEOUT_MS);
  }

  async complete(request: CompletionRequest, config: ProviderConfig): Promise<CompletionResult> {
    return withTimeout(async (signal) => {
      const start = Date.now();
      const resp = await fetch(`${config.baseUrl ?? DEFAULT_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey ?? ""}` },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
          ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        }),
        signal,
      });
      const text = await resp.text();
      if (!resp.ok) throw new ProviderException(httpStatusToProviderError(resp.status, text));

      const data = JSON.parse(text) as OpenAiChatResponse;
      return {
        text: data.choices[0]?.message.content ?? "",
        usage: { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens },
        latencyMs: Date.now() - start,
        model: data.model,
        raw: data,
      };
    }, DEFAULT_TIMEOUT_MS);
  }

  estimateCost(request: CompletionRequest): CostEstimate {
    const pricing = PRICING[request.model];
    if (!pricing) return { estimatedUsd: null, basis: `No known pricing for model "${request.model}".` };

    // Pre-call estimate: ~4 chars/token heuristic on the prompt, plus the requested (or a default) output budget.
    const promptTokens = Math.ceil((request.systemPrompt.length + request.userPrompt.length) / 4);
    const outputTokens = request.maxTokens ?? 500;
    const estimatedUsd = (promptTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;

    return {
      estimatedUsd: Math.round(estimatedUsd * 10000) / 10000,
      basis: `${request.model}: $${pricing.inputPer1k}/1K in, $${pricing.outputPer1k}/1K out (est.)`,
    };
  }
}
