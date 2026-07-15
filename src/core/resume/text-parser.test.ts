import { describe, expect, test } from "vitest";
import { TextResumeParser } from "./text-parser";

const SAMPLE = `Ada Lovelace
ada@example.com

SUMMARY
Engineer with a passion for distributed systems.

EXPERIENCE
Senior Engineer, Acme Corp
Jan 2022 - Present
- Built scalable APIs using TypeScript.
- Reduced latency by 30%.

SKILLS
Programming Languages: TypeScript, Python
`;

describe("TextResumeParser", () => {
  test("detects standard sections and populates bullets", async () => {
    const parser = new TextResumeParser();
    const { resume, warnings } = await parser.parse(SAMPLE);

    expect(resume.meta.name).toBe("Ada Lovelace");
    expect(resume.meta.contact.email).toBe("ada@example.com");

    const sectionTypes = resume.sections.map((s) => s.type);
    expect(sectionTypes).toContain("summary");
    expect(sectionTypes).toContain("experience");
    expect(sectionTypes).toContain("skills");

    const experience = resume.sections.find((s) => s.type === "experience");
    expect(experience?.entries[0]?.heading).toBe("Senior Engineer, Acme Corp");
    expect(experience?.entries[0]?.bullets).toHaveLength(2);
    expect(experience?.entries[0]?.bullets[0]?.text).toBe("Built scalable APIs using TypeScript.");

    expect(resume.markdownSource).toContain("## SUMMARY");
    expect(warnings).toHaveLength(0);
  });

  test("flags resumes with no detectable sections", async () => {
    const parser = new TextResumeParser();
    const { warnings } = await parser.parse("Just a name\nSome unstructured text with no headers.");
    expect(warnings.some((w) => w.severity === "warning")).toBe(true);
  });
});
