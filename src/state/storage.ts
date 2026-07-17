/**
 * Single shared StorageAdapter instance for the whole app. Per docs/architecture.md §4,
 * `components/` never reaches into `core/storage/` directly — only `state/` does, through this.
 */

import { IndexedDbStorageAdapter } from "../core/storage/indexeddb";
import type { StorageAdapter } from "../core/storage/types";

export const storage: StorageAdapter = new IndexedDbStorageAdapter();
