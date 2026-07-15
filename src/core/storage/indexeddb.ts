/**
 * IndexedDB implementation of StorageAdapter. Local-first persistence per ADR-002 —
 * no data leaves the browser through this module.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Resume } from "../schema/resume";
import type { JobDescription } from "../schema/job-description";
import type { ResumeVersion, Suggestion } from "../schema/suggestion";
import type { ProviderConfig } from "../providers/types";
import type { StorageAdapter, StoreMap, StoreName } from "./types";

const DB_NAME = "ats-resume-optimizer";
const DB_VERSION = 1;

interface AppDBSchema extends DBSchema {
  resumes: { key: string; value: Resume };
  resumeVersions: { key: string; value: ResumeVersion; indexes: { resumeId: string } };
  jobDescriptions: { key: string; value: JobDescription };
  suggestions: { key: string; value: Suggestion; indexes: { resumeEntryId: string } };
  providerConfigs: { key: string; value: ProviderConfig };
}

/** Primary key path per store — most use `id`; providerConfigs is keyed by `providerId`. */
const KEY_PATHS: Record<StoreName, string> = {
  resumes: "id",
  resumeVersions: "id",
  jobDescriptions: "id",
  suggestions: "id",
  providerConfigs: "providerId",
};

function openAppDb(): Promise<IDBPDatabase<AppDBSchema>> {
  return openDB<AppDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("resumes", { keyPath: KEY_PATHS.resumes });
      db.createObjectStore("resumeVersions", { keyPath: KEY_PATHS.resumeVersions }).createIndex(
        "resumeId",
        "resumeId",
      );
      db.createObjectStore("jobDescriptions", { keyPath: KEY_PATHS.jobDescriptions });
      db.createObjectStore("suggestions", { keyPath: KEY_PATHS.suggestions }).createIndex(
        "resumeEntryId",
        "resumeEntryId",
      );
      db.createObjectStore("providerConfigs", { keyPath: KEY_PATHS.providerConfigs });
    },
  });
}

export class IndexedDbStorageAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBPDatabase<AppDBSchema>>;

  constructor() {
    this.dbPromise = openAppDb();
  }

  async get<S extends StoreName>(store: S, id: string): Promise<StoreMap[S] | undefined> {
    const db = await this.dbPromise;
    return (await db.get(store, id)) as StoreMap[S] | undefined;
  }

  async getAll<S extends StoreName>(store: S): Promise<StoreMap[S][]> {
    const db = await this.dbPromise;
    return (await db.getAll(store)) as StoreMap[S][];
  }

  async put<S extends StoreName>(store: S, value: StoreMap[S]): Promise<void> {
    const db = await this.dbPromise;
    await db.put(store, value as never);
  }

  async delete<S extends StoreName>(store: S, id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(store, id);
  }

  async getAllByIndex<S extends StoreName>(
    store: S,
    indexName: string,
    value: string,
  ): Promise<StoreMap[S][]> {
    // idb types getAllFromIndex per-store; our StorageAdapter is generic over any store,
    // which a specific store's index types can't statically satisfy — bridge with `any` here,
    // the public StorageAdapter interface stays fully typed at the call site.
    const db = (await this.dbPromise) as IDBPDatabase<any>;
    return (await db.getAllFromIndex(store, indexName, value)) as StoreMap[S][];
  }

  async clear<S extends StoreName>(store: S): Promise<void> {
    const db = await this.dbPromise;
    await db.clear(store);
  }
}
