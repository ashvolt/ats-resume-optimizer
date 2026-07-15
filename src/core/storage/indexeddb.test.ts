import { beforeEach, describe, expect, test } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDbStorageAdapter } from "./indexeddb";
import type { Resume } from "../schema/resume";
import type { ResumeVersion } from "../schema/suggestion";

function makeResume(id: string): Resume {
  return {
    id,
    schemaVersion: 1,
    meta: { name: "Ada Lovelace", contact: {} },
    sections: [],
    markdownSource: "# Ada Lovelace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeVersion(id: string, resumeId: string): ResumeVersion {
  return {
    id,
    resumeId,
    snapshot: makeResume(resumeId),
    atsScore: {
      score: 50,
      computedAt: new Date().toISOString(),
      breakdown: [],
      deductions: [],
      source: "deterministic",
    },
    triggeredBy: { type: "manual-edit" },
    createdAt: new Date().toISOString(),
  };
}

describe("IndexedDbStorageAdapter", () => {
  let adapter: IndexedDbStorageAdapter;

  beforeEach(() => {
    indexedDB = new IDBFactory();
    adapter = new IndexedDbStorageAdapter();
  });

  test("put then get round-trips a record", async () => {
    const resume = makeResume("resume-1");
    await adapter.put("resumes", resume);
    await expect(adapter.get("resumes", "resume-1")).resolves.toEqual(resume);
  });

  test("get returns undefined for a missing id", async () => {
    await expect(adapter.get("resumes", "does-not-exist")).resolves.toBeUndefined();
  });

  test("getAll returns every record in the store", async () => {
    await adapter.put("resumes", makeResume("resume-1"));
    await adapter.put("resumes", makeResume("resume-2"));
    const all = await adapter.getAll("resumes");
    expect(all.map((r) => r.id).sort()).toEqual(["resume-1", "resume-2"]);
  });

  test("delete removes a record", async () => {
    await adapter.put("resumes", makeResume("resume-1"));
    await adapter.delete("resumes", "resume-1");
    await expect(adapter.get("resumes", "resume-1")).resolves.toBeUndefined();
  });

  test("getAllByIndex filters resumeVersions by resumeId", async () => {
    await adapter.put("resumeVersions", makeVersion("v1", "resume-1"));
    await adapter.put("resumeVersions", makeVersion("v2", "resume-1"));
    await adapter.put("resumeVersions", makeVersion("v3", "resume-2"));

    const versionsForResume1 = await adapter.getAllByIndex("resumeVersions", "resumeId", "resume-1");
    expect(versionsForResume1.map((v) => v.id).sort()).toEqual(["v1", "v2"]);
  });

  test("clear empties a store without affecting others", async () => {
    await adapter.put("resumes", makeResume("resume-1"));
    await adapter.put("jobDescriptions", {
      id: "jd-1",
      schemaVersion: 1,
      source: { type: "paste" },
      rawText: "We need a Kubernetes expert",
      language: "en",
      structured: { sections: [] },
      keywords: [],
      createdAt: new Date().toISOString(),
    });

    await adapter.clear("resumes");

    await expect(adapter.getAll("resumes")).resolves.toEqual([]);
    await expect(adapter.getAll("jobDescriptions")).resolves.toHaveLength(1);
  });
});
