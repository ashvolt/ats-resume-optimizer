import type { KeywordCategory } from "../schema/job-description";
import { KEYWORD_CATEGORIES } from "./constants";

/** Bigrams are classified by their first word (e.g. "kubernetes cluster" -> cloud). */
export function classifyKeyword(term: string): KeywordCategory {
  const base = term.split(" ")[0] ?? term;
  for (const [category, terms] of Object.entries(KEYWORD_CATEGORIES)) {
    if (terms.has(term) || terms.has(base)) return category as KeywordCategory;
  }
  return "general";
}
