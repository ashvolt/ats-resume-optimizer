/**
 * Provider registry — the seam ADR-003 leaves open for adding Gemini/Groq/OpenRouter/LM Studio/
 * custom OpenAI-compatible adapters later without touching core scoring/suggestion logic.
 */

import type { ProviderAdapter } from "./types";
import { OpenAiAdapter } from "./openai";
import { AnthropicAdapter } from "./anthropic";
import { OllamaAdapter } from "./ollama";

const registry = new Map<string, ProviderAdapter>(
  [new OpenAiAdapter(), new AnthropicAdapter(), new OllamaAdapter()].map((adapter) => [adapter.id, adapter]),
);

export function getProviderAdapter(id: string): ProviderAdapter | undefined {
  return registry.get(id);
}

export function listProviderAdapters(): ProviderAdapter[] {
  return [...registry.values()];
}
