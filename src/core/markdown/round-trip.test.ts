import { describe, expect, test } from "vitest";
import type { Resume } from "../schema/resume";
import { renderMarkdown } from "./render";
import { parseMarkdown } from "./parse";

function sampleResume(): Resume {
  const now = new Date().toISOString();
  return {
    id: "resume-1",
    schemaVersion: 1,
    meta: { name: "Ada Lovelace", title: "Senior Engineer", contact: { email: "ada@example.com" } },
    sections: [
      {
        id: "sec-1",
        type: "experience",
        title: "Experience",
        entries: [
          {
            id: "entry-1",
            heading: "Senior Engineer, Acme Corp",
            subheading: "Jan 2022 - Present",
            bullets: [
              { id: "b1", text: "Built scalable APIs using TypeScript.", origin: "user" },
              { id: "b2", text: "Reduced latency by 30%.", origin: "user" },
            ],
          },
        ],
      },
      {
        id: "sec-2",
        type: "skills",
        title: "Skills",
        entries: [{ id: "entry-2", bullets: [{ id: "b3", text: "TypeScript, Python, Kubernetes", origin: "user" }] }],
      },
    ],
    markdownSource: "",
    createdAt: now,
    updatedAt: now,
  };
}

describe("markdown round-trip", () => {
  test("parseMarkdown(renderMarkdown(resume)) preserves structure", () => {
    const original = sampleResume();
    const markdown = renderMarkdown(original);
    const { resume: reparsed, warnings } = parseMarkdown(markdown);

    expect(warnings).toHaveLength(0);
    expect(reparsed.meta.name).toBe(original.meta.name);
    expect(reparsed.meta.title).toBe(original.meta.title);
    expect(reparsed.meta.contact.email).toBe(original.meta.contact.email);
    expect(reparsed.sections.map((s) => s.title)).toEqual(original.sections.map((s) => s.title));
    expect(reparsed.sections[0]?.entries[0]?.heading).toBe("Senior Engineer, Acme Corp");
    expect(reparsed.sections[0]?.entries[0]?.bullets.map((b) => b.text)).toEqual([
      "Built scalable APIs using TypeScript.",
      "Reduced latency by 30%.",
    ]);
  });

  test("malformed markdown (bullet before any section) degrades to a warning, not a throw", () => {
    expect(() => parseMarkdown("# Ada Lovelace\n- an orphan bullet\n")).not.toThrow();
    const { resume, warnings } = parseMarkdown("# Ada Lovelace\n- an orphan bullet\n");
    expect(warnings.length).toBeGreaterThan(0);
    expect(resume.sections[0]?.title).toBe("Other");
  });
});
