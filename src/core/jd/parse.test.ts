import { describe, expect, test } from "vitest";
import { parseJd } from "./parse";

describe("parseJd", () => {
  test("assembles a JobDescription with weighted, categorized keywords", () => {
    const jd = parseJd(
      [
        "Senior Backend Engineer",
        "Requirements",
        "5+ years of TypeScript and Kubernetes experience required.",
        "Strong knowledge of PostgreSQL required.",
        "Benefits",
        "Unlimited vacation and a passionate, fast-paced culture.",
      ].join("\n"),
      { type: "paste" },
    );

    expect(jd.schemaVersion).toBe(1);
    expect(jd.language).toBe("en");
    expect(jd.structured.role).toBe("Senior Backend Engineer");

    const terms = jd.keywords.map((k) => k.term);
    expect(terms).toContain("typescript");
    expect(terms).toContain("kubernetes");
    expect(terms).toContain("postgresql");
    // Benefits-section-only noise words must never surface as keywords.
    expect(terms).not.toContain("passionate");
    expect(terms).not.toContain("culture");

    const kubernetes = jd.keywords.find((k) => k.term === "kubernetes");
    expect(kubernetes?.category).toBe("cloud");
  });

  test("detects non-Latin script and flags a non-English language", () => {
    const jd = parseJd("Требуется опытный инженер со знанием Kubernetes.", { type: "paste" });
    expect(jd.language).toBe("ru");
  });
});
