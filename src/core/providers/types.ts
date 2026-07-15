/**
 * AI provider adapter contract (BYOM). Full design: docs/features/ai-provider.md, ADR-003.
 * Reference implementations (OpenAI, Anthropic, Ollama) land in M2 (docs/ROADMAP.md).
 */

export interface ProviderConfig {
  providerId: string;
  apiKey?: string; // absent for Ollama
  baseUrl?: string; // override for self-hosted/compatible endpoints
  defaultModel: string;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  contextWindow?: number;
}

export interface CompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  usage: { promptTokens: number; completionTokens: number };
  latencyMs: number;
  model: string;
  raw?: unknown; // provider's raw response, for debugging only — never parsed by callers
}

export interface CostEstimate {
  estimatedUsd: number | null; // null when the provider has no known pricing (e.g. local models)
  basis: string; // human-readable, e.g. "$0.15/1K tokens (gpt-4o-mini, est.)"
}

export type ProviderError =
  | { kind: "auth"; message: string }
  | { kind: "rate_limit"; message: string; retryAfterMs?: number }
  | { kind: "timeout"; message: string }
  | { kind: "model_not_found"; message: string }
  | { kind: "content_filtered"; message: string }
  | { kind: "network"; message: string }
  | { kind: "unknown"; message: string; raw?: unknown };

export interface ProviderAdapter {
  readonly id: string; // "openai" | "anthropic" | "ollama" | ...
  readonly displayName: string;
  readonly requiresApiKey: boolean;

  listModels(config: ProviderConfig): Promise<ModelInfo[]>;
  complete(request: CompletionRequest, config: ProviderConfig): Promise<CompletionResult>;
  estimateCost(request: CompletionRequest, config: ProviderConfig): CostEstimate;
}
