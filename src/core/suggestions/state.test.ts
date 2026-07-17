import { describe, expect, test } from "vitest";
import type { Resume } from "../schema/resume";
import type { Suggestion } from "../schema/suggestion";
import type { StorageAdapter, StoreMap, StoreName } from "../storage/types";
import { parseJd } from "../jd/parse";
import { acceptSuggestion, findStaleSuggestions, rejectSuggestion, StaleSuggestionError } from "./state";

class InMemoryStorage implements StorageAdapter {
  private stores = new Map<StoreName, Map<string, unknown>>();

  private storeFor<S extends StoreName>(store: S): Map<string, StoreMap[S]> {
    if (!this.stores.has(store)) this.stores.set(store, new Map());
    return this.stores.get(store) as Map<string, StoreMap[S]>;
  }

  async get<S extends StoreName>(store: S, id: string) {
    return this.storeFor(store).get(id);
  }
  async getAll<S extends StoreName>(store: S) {
    return Array.from(this.storeFor(store).values());
  }
  async put<S extends StoreName>(store: S, value: StoreMap[S]) {
    this.storeFor(store).set((value as { id: string }).id, value);
  }
  async delete<S extends StoreName>(store: S, id: string) {
    this.storeFor(store).delete(id);
  }
  async getAllByIndex<S extends StoreName>(store: S, _indexName: string, _value: string) {
    return Array.from(this.storeFor(store).values());
  }
  async clear<S extends StoreName>(store: S) {
    this.storeFor(store).clear();
  }
}

function baseResume(): Resume {
  const now = new Date().toISOString();
  return {
    id: "resume-1",
    schemaVersion: 1,
    meta: { name: "Ada Lovelace", contact: { email: "ada@example.com" } },
    sections: [
      { id: "s3", type: "skills", title: "Skills", entries: [{ id: "e3", bullets: [{ id: "b4", text: "TypeScript, Docker", origin: "user" }] }] },
    ],
    markdownSource: "# Ada Lovelace",
    createdAt: now,
    updatedAt: now,
  };
}

const jd = parseJd("Requirements\nTypeScript and Kubernetes required.", { type: "paste" });

function pendingSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: "sug-1",
    resumeEntryId: "b4",
    kind: "keyword-injection",
    original: "TypeScript, Docker",
    proposed: "TypeScript, Docker, Kubernetes",
    reason: '"kubernetes" appears in the JD.',
    source: "deterministic",
    status: "pending",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("acceptSuggestion", () => {
  test("applies the proposed text, appends a version with a fresh score, and persists everything", async () => {
    const resume = baseResume();
    const suggestion = pendingSuggestion();
    const storage = new InMemoryStorage();

    const result = await acceptSuggestion(suggestion, resume, jd, [suggestion], storage);

    expect(result).not.toBeNull();
    expect(result!.resume.sections[0]!.entries[0]!.bullets[0]!.text).toBe("TypeScript, Docker, Kubernetes");
    expect(result!.version.triggeredBy).toEqual({ type: "suggestion", suggestionId: "sug-1" });
    expect(result!.version.atsScore).toBeDefined();
    expect(result!.invalidated).toHaveLength(0);

    expect(await storage.get("resumes", "resume-1")).toEqual(result!.resume);
    expect(await storage.get("resumeVersions", result!.version.id)).toEqual(result!.version);
    const persistedSuggestion = await storage.get("suggestions", "sug-1");
    expect(persistedSuggestion?.status).toBe("accepted");
  });

  test("marks the bullet origin ai-accepted only for AI-sourced suggestions", async () => {
    const resume = baseResume();
    const suggestion = pendingSuggestion({ source: "ai" });
    const storage = new InMemoryStorage();

    const result = await acceptSuggestion(suggestion, resume, jd, [suggestion], storage);
    expect(result!.resume.sections[0]!.entries[0]!.bullets[0]!.origin).toBe("ai-accepted");
  });

  test("invalidates other pending suggestions targeting the same bullet", async () => {
    const resume = baseResume();
    const winner = pendingSuggestion({ id: "sug-1" });
    const loser = pendingSuggestion({ id: "sug-2", proposed: "TypeScript, Docker, GraphQL" });
    const storage = new InMemoryStorage();

    const result = await acceptSuggestion(winner, resume, jd, [winner, loser], storage);

    expect(result!.invalidated).toHaveLength(1);
    expect(result!.invalidated[0]!.id).toBe("sug-2");
    expect(result!.invalidated[0]!.status).toBe("rejected");
    expect((await storage.get("suggestions", "sug-2"))?.status).toBe("rejected");
  });

  test("is idempotent — accepting an already-resolved suggestion is a no-op", async () => {
    const resume = baseResume();
    const suggestion = pendingSuggestion({ status: "accepted" });
    const storage = new InMemoryStorage();

    const result = await acceptSuggestion(suggestion, resume, jd, [suggestion], storage);
    expect(result).toBeNull();
    expect(await storage.get("resumes", "resume-1")).toBeUndefined();
  });

  test("throws StaleSuggestionError and drops the suggestion when the bullet was manually edited since", async () => {
    const resume = baseResume();
    resume.sections[0]!.entries[0]!.bullets[0]!.text = "TypeScript, Docker, Rust"; // manual edit after suggestion was generated
    const suggestion = pendingSuggestion(); // original still says "TypeScript, Docker"
    const storage = new InMemoryStorage();

    await expect(acceptSuggestion(suggestion, resume, jd, [suggestion], storage)).rejects.toBeInstanceOf(StaleSuggestionError);
    expect((await storage.get("suggestions", "sug-1"))?.status).toBe("rejected");
  });
});

describe("rejectSuggestion", () => {
  test("marks a pending suggestion rejected with a timestamp", async () => {
    const storage = new InMemoryStorage();
    const rejected = await rejectSuggestion(pendingSuggestion(), storage);
    expect(rejected.status).toBe("rejected");
    expect(rejected.resolvedAt).toBeDefined();
  });

  test("is idempotent — rejecting an already-resolved suggestion is a no-op", async () => {
    const storage = new InMemoryStorage();
    const alreadyRejected = pendingSuggestion({ status: "rejected", resolvedAt: "2026-01-01T00:00:00.000Z" });
    const result = await rejectSuggestion(alreadyRejected, storage);
    expect(result).toBe(alreadyRejected);
  });
});

describe("findStaleSuggestions", () => {
  test("flags a pending suggestion whose original no longer matches the resume's current bullet text", () => {
    const resume = baseResume();
    resume.sections[0]!.entries[0]!.bullets[0]!.text = "TypeScript, Docker, Rust";
    const suggestion = pendingSuggestion();

    expect(findStaleSuggestions(resume, [suggestion])).toEqual([suggestion]);
  });

  test("ignores already-resolved suggestions", () => {
    const resume = baseResume();
    resume.sections[0]!.entries[0]!.bullets[0]!.text = "TypeScript, Docker, Rust";
    const suggestion = pendingSuggestion({ status: "rejected" });

    expect(findStaleSuggestions(resume, [suggestion])).toEqual([]);
  });

  test("leaves a suggestion alone when its target text is unchanged", () => {
    const resume = baseResume();
    const suggestion = pendingSuggestion();
    expect(findStaleSuggestions(resume, [suggestion])).toEqual([]);
  });
});
