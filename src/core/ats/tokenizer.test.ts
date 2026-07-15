import { describe, expect, test } from "vitest";
import { tokenFrequency, tokenizeSentences } from "./tokenizer";

describe("tokenizeSentences", () => {
  test("bigrams never cross sentence boundaries", () => {
    const sentences = tokenizeSentences("Senior developer. Skills required: React.");
    // "developer" and "skills" must never appear together as a bigram — they're two sentences.
    const allTokensInOneSentence = sentences.some((s) => s.includes("developer") && s.includes("skills"));
    expect(allTokensInOneSentence).toBe(false);
  });

  test("strips trailing punctuation from tokens", () => {
    const sentences = tokenizeSentences("We use React, Node.js, and AWS.");
    const flat = sentences.flat();
    expect(flat).not.toContain("react,");
    expect(flat).toContain("react");
  });

  test("normalizes node.js-style tokens to the canonical form", () => {
    const sentences = tokenizeSentences("Experience with Node.js required.");
    expect(sentences.flat()).toContain("node.js");
  });
});

describe("tokenFrequency", () => {
  test("bigram crossing a sentence boundary never accumulates frequency", () => {
    const freq = tokenFrequency("Senior developer. Skills required: Kubernetes.");
    expect(freq["developer skills"]).toBeUndefined();
  });

  test("within-sentence bigrams are weighted 1.5x", () => {
    const freq = tokenFrequency("Kubernetes cluster management required.");
    expect(freq["kubernetes cluster"]).toBe(1.5);
  });
});
