import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { PdfResumeParser } from "./pdf-parser";

const fixturePath = path.resolve(process.cwd(), "tests/fixtures/sample-resume.pdf");

describe("PdfResumeParser", () => {
  test("extracts text and detects sections from a real PDF", async () => {
    const bytes = readFileSync(fixturePath);
    const file = new File([bytes], "sample-resume.pdf", { type: "application/pdf" });

    const parser = new PdfResumeParser();
    const { resume, warnings } = await parser.parse(file);

    expect(resume.meta.name).toBe("Ada Lovelace");
    expect(resume.meta.contact.email).toBe("ada@example.com");

    const sectionTypes = resume.sections.map((s) => s.type);
    expect(sectionTypes).toContain("summary");
    expect(sectionTypes).toContain("experience");

    const experience = resume.sections.find((s) => s.type === "experience");
    expect(experience?.entries[0]?.bullets[0]?.text).toContain("TypeScript");

    // Informational layout-fidelity note is always present; no low-text warning for a real fixture.
    expect(warnings.some((w) => w.severity === "info")).toBe(true);
    expect(warnings.some((w) => w.message.includes("scanned/image-based"))).toBe(false);
  });

  test("rejects string input — PDFs must come from a File/Blob", async () => {
    const parser = new PdfResumeParser();
    await expect(parser.parse("not a file")).rejects.toBeInstanceOf(TypeError);
  });
});
