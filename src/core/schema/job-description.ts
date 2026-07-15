/**
 * Canonical Job Description schema. Source of truth per docs/architecture.md §3.2.
 */

export type JdSectionLabel =
  | "requirements"
  | "responsibilities"
  | "preferred"
  | "about"
  | "other";

export interface JDSection {
  label: JdSectionLabel;
  weight: number; // 0–2×, see docs/features/ats-engine.md
  text: string;
}

export type KeywordCategory =
  | "language"
  | "framework"
  | "database"
  | "cloud"
  | "tool"
  | "methodology"
  | "general";

export interface Keyword {
  term: string;
  category: KeywordCategory;
  frequency: number;
  weight: number; // frequency × section weight × bigram multiplier
}

export interface JobDescriptionSource {
  type: "paste" | "url";
  url?: string;
  scrapedAt?: string;
}

export interface JobDescriptionStructured {
  company?: string;
  role?: string;
  sections: JDSection[];
}

export interface JobDescription {
  id: string;
  schemaVersion: 1;
  source: JobDescriptionSource;
  rawText: string;
  language: string; // BCP-47, detected
  structured: JobDescriptionStructured;
  keywords: Keyword[];
  createdAt: string;
}
