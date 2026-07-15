import { describe, expect, test } from "vitest";
import { parseJdSections } from "./section-parser";

describe("parseJdSections", () => {
  test("classifies Requirements, Responsibilities, Preferred, and Benefits with the right weights", () => {
    const jd = [
      "Requirements",
      "5+ years of TypeScript experience",
      "Responsibilities",
      "Build scalable APIs",
      "Nice to have",
      "Experience with Rust",
      "Benefits",
      "We offer a generous package and great work-life balance.",
    ].join("\n");

    const sections = parseJdSections(jd);
    const byLabel = Object.fromEntries(sections.map((s) => [s.label, s]));

    expect(byLabel.requirements?.weight).toBe(2.0);
    expect(byLabel.responsibilities?.weight).toBe(1.5);
    expect(byLabel.preferred?.weight).toBe(0.5);
    expect(byLabel.about?.weight).toBe(0);
    expect(byLabel.requirements?.text).toContain("TypeScript");
  });

  test("falls back to a single full-weight section when no headers are detected", () => {
    const sections = parseJdSections("We need someone great with React and Node.");
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ label: "other", weight: 1.0 });
  });
});
