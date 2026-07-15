/**
 * Sentence-aware tokenizer. Bigrams never cross sentence boundaries — this is the fix for the
 * DEVELOPMENT_PLAN.md-documented bug where tokens like "developer. skills" leaked into the
 * top-ranked keyword list. See docs/features/ats-engine.md § deterministic core, item 1.
 */

import { NORMALISE, STOPWORDS } from "./constants";

export function normalizeToken(raw: string): string {
  // Sentence-splitting (below) deliberately keeps periods in-stream so it can use them as
  // boundaries, which means the last word of every sentence still carries its trailing "." —
  // strip it here rather than in the sentence-level regex, so mid-token dots (versions, "c#"-style
  // suffixes) survive untouched. This is the DEVELOPMENT_PLAN.md "developer." token-punctuation bug.
  const cleaned = raw
    .replace(/[^a-z0-9.+#/-]/g, "")
    .toLowerCase()
    .replace(/\.+$/, "");
  return NORMALISE[cleaned] ?? cleaned;
}

/** Splits text into sentences, then into filtered/normalized tokens per sentence. */
export function tokenizeSentences(text: string): string[][] {
  // Protect dotted tech abbreviations (node.js, vue.js, c++) *before* sentence-splitting —
  // otherwise the period inside "Node.js" itself gets read as a sentence boundary and the
  // "nodejs -> node.js" normalization below never sees the two halves in the same sentence.
  const protectedText = text.replace(/\b(\w+)\.js\b/gi, "$1js").replace(/\bc\+\+/gi, "cpp");

  return protectedText
    .replace(/([.;:!?\n])\s*/g, "$1\n")
    .split("\n")
    .filter((s) => s.trim().length > 2)
    .map((sentence) =>
      sentence
        .toLowerCase()
        .replace(/[^a-z0-9\s.+#/-]/g, " ")
        .split(/\s+/)
        .map(normalizeToken)
        .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
    );
}

/** Unigram + within-sentence bigram frequency map (bigrams weighted 1.5x). */
export function tokenFrequency(text: string): Record<string, number> {
  const sentences = tokenizeSentences(text);
  const freq: Record<string, number> = {};
  for (const tokens of sentences) {
    for (const t of tokens) freq[t] = (freq[t] ?? 0) + 1;
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      freq[bigram] = (freq[bigram] ?? 0) + 1.5;
    }
  }
  return freq;
}
