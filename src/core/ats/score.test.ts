import { describe, expect, test } from "vitest";
import type { Resume } from "../schema/resume";
import { parseJd } from "../jd/parse";
import { scoreResume } from "./score";

function baseResume(overrides: Partial<Resume> = {}): Resume {
  const now = new Date().toISOString();
  return {
    id: "resume-1",
    schemaVersion: 1,
    meta: { name: "Ada Lovelace", contact: { email: "ada@example.com" } },
    sections: [
      { id: "s1", type: "summary", title: "Summary", entries: [{ id: "e1", bullets: [{ id: "b1", text: "Engineer focused on backend systems.", origin: "user" }] }] },
      {
        id: "s2",
        type: "experience",
        title: "Experience",
        entries: [
          {
            id: "e2",
            heading: "Senior Engineer, Acme Corp",
            bullets: [
              { id: "b2", text: "Built scalable APIs using TypeScript and Kubernetes.", origin: "user" },
              { id: "b3", text: "Reduced deployment time by 40% using Docker.", origin: "user" },
            ],
          },
        ],
      },
      { id: "s3", type: "skills", title: "Skills", entries: [{ id: "e3", bullets: [{ id: "b4", text: "TypeScript, Kubernetes, Docker, PostgreSQL", origin: "user" }] }] },
      { id: "s4", type: "education", title: "Education", entries: [{ id: "e4", heading: "BS Computer Science", bullets: [] }] },
    ],
    markdownSource: "# Ada Lovelace",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const JD_TEXT = [
  "Senior Backend Engineer",
  "Requirements",
  "5+ years of TypeScript and Kubernetes experience required.",
  "Strong knowledge of Docker and PostgreSQL required.",
  "Experience with Rust is required.",
  "Benefits",
  "Unlimited vacation and a passionate culture.",
].join("\n");

describe("scoreResume", () => {
  test("is a pure function — identical input yields an identical score and deduction list", () => {
    const resume = baseResume();
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const a = scoreResume(resume, jd);
    const b = scoreResume(resume, jd);
    expect(a.score).toBe(b.score);
    expect(a.deductions.length).toBe(b.deductions.length);
  });

  test("rewards a resume that covers most required keywords with an above-average score", () => {
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const result = scoreResume(baseResume(), jd);
    expect(result.score).toBeGreaterThan(50);
  });

  test("flags Rust as a missing keyword with a specific reason and recommendation", () => {
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const result = scoreResume(baseResume(), jd);
    const rustDeduction = result.deductions.find((d) => d.reason.includes("rust"));
    expect(rustDeduction).toBeDefined();
    expect(rustDeduction?.category).toBe("keyword");
    expect(rustDeduction?.recommendation).toContain("rust");
  });

  test("never surfaces Benefits-only words as missing keywords", () => {
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const result = scoreResume(baseResume(), jd);
    expect(result.deductions.some((d) => d.reason.includes("passionate"))).toBe(false);
  });

  test("flags a missing standard section", () => {
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const noEducation = baseResume({ sections: baseResume().sections.filter((s) => s.type !== "education") });
    const result = scoreResume(noEducation, jd);
    expect(result.deductions.some((d) => d.category === "section-completeness" && d.reason.includes("education"))).toBe(true);
  });

  test("flags weak-verb bullets", () => {
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const weak = baseResume();
    weak.sections[1]!.entries[0]!.bullets[0]!.text = "Used TypeScript to build things.";
    const result = scoreResume(weak, jd);
    expect(result.deductions.some((d) => d.category === "action-verb")).toBe(true);
  });

  test("flags bullets with no quantified impact", () => {
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const noMetrics = baseResume();
    for (const section of noMetrics.sections) {
      for (const entry of section.entries) {
        for (const bullet of entry.bullets) bullet.text = bullet.text.replace(/\d+%?/g, "some amount");
      }
    }
    const result = scoreResume(noMetrics, jd);
    expect(result.deductions.some((d) => d.category === "impact-metric")).toBe(true);
  });

  test("flags an HTML table as a formatting hazard", () => {
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const withTable = baseResume({ markdownSource: "# Ada\n<table><tr><td>Skills</td></tr></table>" });
    const result = scoreResume(withTable, jd);
    expect(result.deductions.some((d) => d.category === "formatting")).toBe(true);
  });

  test("flags a low-signal JD without crashing", () => {
    const jd = parseJd("Great opportunity!", { type: "paste" });
    const result = scoreResume(baseResume(), jd);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.deductions.some((d) => d.reason.includes("too short or too generic"))).toBe(true);
  });

  test("clamps score to [0, 100]", () => {
    const jd = parseJd(JD_TEXT, { type: "paste" });
    const empty = baseResume({ sections: [], markdownSource: "# Empty" });
    const result = scoreResume(empty, jd);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
