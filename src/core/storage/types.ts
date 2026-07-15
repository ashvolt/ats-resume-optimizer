/**
 * Storage contract. Full design: docs/architecture.md §10 ("database design").
 *
 * This is the seam ADR-002 leaves open for an optional future self-hosted sync backend —
 * feature code (state/*) must depend on this interface, never call indexedDB directly.
 */

import type { Resume } from "../schema/resume";
import type { JobDescription } from "../schema/job-description";
import type { ResumeVersion, Suggestion } from "../schema/suggestion";
import type { ProviderConfig } from "../providers/types";

/** Object stores, matching docs/architecture.md §10. */
export interface StoreMap {
  resumes: Resume;
  resumeVersions: ResumeVersion;
  jobDescriptions: JobDescription;
  suggestions: Suggestion;
  providerConfigs: ProviderConfig;
}

export type StoreName = keyof StoreMap;

export interface StorageAdapter {
  get<S extends StoreName>(store: S, id: string): Promise<StoreMap[S] | undefined>;
  getAll<S extends StoreName>(store: S): Promise<StoreMap[S][]>;
  put<S extends StoreName>(store: S, value: StoreMap[S]): Promise<void>;
  delete<S extends StoreName>(store: S, id: string): Promise<void>;
  /** Records whose key is not their own `id` (e.g. resumeVersions by resumeId) use a named index. */
  getAllByIndex<S extends StoreName>(store: S, indexName: string, value: string): Promise<StoreMap[S][]>;
  clear<S extends StoreName>(store: S): Promise<void>;
}
