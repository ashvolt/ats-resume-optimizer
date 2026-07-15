import { describe, expect, test } from "vitest";
import { getProviderAdapter, listProviderAdapters } from "./registry";

describe("provider registry", () => {
  test("ships OpenAI, Anthropic, and Ollama adapters for v1 (ADR-003)", () => {
    const ids = listProviderAdapters().map((a) => a.id);
    expect(ids).toEqual(["openai", "anthropic", "ollama"]);
  });

  test("getProviderAdapter resolves a known id and is undefined for an unknown one", () => {
    expect(getProviderAdapter("openai")?.displayName).toBe("OpenAI");
    expect(getProviderAdapter("does-not-exist")).toBeUndefined();
  });
});
