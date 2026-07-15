/**
 * Best-effort language detection. Deliberately minimal — full multi-language support is out of
 * scope for v1 (docs/architecture.md open question 6, docs/features/future-roadmap.md); this only
 * needs to flag when the English-tuned section/keyword heuristics elsewhere may be unreliable.
 */

const SCRIPT_RANGES: ReadonlyArray<{ lang: string; re: RegExp }> = [
  { lang: "ja", re: /[぀-ヿ]/ }, // hiragana/katakana
  { lang: "zh", re: /[一-鿿]/ }, // CJK unified ideographs
  { lang: "ko", re: /[가-힯]/ }, // hangul
  { lang: "ru", re: /[Ѐ-ӿ]/ }, // cyrillic
  { lang: "ar", re: /[؀-ۿ]/ }, // arabic
  { lang: "he", re: /[֐-׿]/ }, // hebrew
];

/** Returns a BCP-47 language tag; defaults to "en" when no other script is detected. */
export function detectLanguage(text: string): string {
  for (const { lang, re } of SCRIPT_RANGES) {
    if (re.test(text)) return lang;
  }
  return "en";
}
