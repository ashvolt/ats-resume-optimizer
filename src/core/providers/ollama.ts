/** Ollama adapter — local, no API key, no known cost. Requires the user to enable CORS locally. */

import type {
  CompletionRequest,
  CompletionResult,
  CostEstimate,
  ModelInfo,
  ProviderAdapter,
  ProviderConfig,
} from "./types";
import { ProviderException, httpStatusToProviderError, withTimeout } from "./errors";

const DEFAULT_TIMEOUT_MS = 60000; // local generation can be slow on modest hardware
const DEFAULT_BASE_URL = "http://localhost:11434";

interface OllamaTagsResponse {
  models: { name: string }[];
}

interface OllamaChatResponse {
  model: string;
  message: { content: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaAdapter implements ProviderAdapter {
  readonly id = "ollama";
  readonly displayName = "Ollama (local)";
  readonly requiresApiKey = false;

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    return withTimeout(async (signal) => {
      const resp = await fetch(`${config.baseUrl ?? DEFAULT_BASE_URL}/api/tags`, { signal });
      const text = await resp.text();
      if (!resp.ok) throw new ProviderException(httpStatusToProviderError(resp.status, text));
      const data = JSON.parse(text) as OllamaTagsResponse;
      return data.models.map((m) => ({ id: m.name, displayName: m.name }));
    }, DEFAULT_TIMEOUT_MS);
  }

  async complete(request: CompletionRequest, config: ProviderConfig): Promise<CompletionResult> {
    return withTimeout(async (signal) => {
      const start = Date.now();
      const resp = await fetch(`${config.baseUrl ?? DEFAULT_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
          stream: false,
          ...(request.temperature !== undefined ? { options: { temperature: request.temperature } } : {}),
        }),
        signal,
      });
      const text = await resp.text();
      if (!resp.ok) throw new ProviderException(httpStatusToProviderError(resp.status, text));

      const data = JSON.parse(text) as OllamaChatResponse;
      return {
        text: data.message.content,
        usage: { promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 },
        latencyMs: Date.now() - start,
        model: data.model,
        raw: data,
      };
    }, DEFAULT_TIMEOUT_MS);
  }

  estimateCost(): CostEstimate {
    return { estimatedUsd: null, basis: "Local model via Ollama — no per-call cost." };
  }
}
