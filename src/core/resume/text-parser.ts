import type { Resume } from "../schema/resume";
import type { ParseResult, ResumeParser } from "./types";
import { extractMeta } from "./meta-extract";
import { buildSectionsFromLines } from "./build-sections";
import { renderMarkdown } from "../markdown/render";
import { generateId } from "../util/id";

export class TextResumeParser implements ResumeParser {
  readonly acceptedTypes = ["text/plain", ".txt"];

  async parse(input: File | string): Promise<ParseResult> {
    const text = typeof input === "string" ? input : await input.text();
    const meta = extractMeta(text);
    const { sections, warnings } = buildSectionsFromLines(text.split("\n"));

    const now = new Date().toISOString();
    const resume: Resume = {
      id: generateId("resume"),
      schemaVersion: 1,
      meta,
      sections,
      markdownSource: "",
      createdAt: now,
      updatedAt: now,
    };
    resume.markdownSource = renderMarkdown(resume);

    return { resume, warnings };
  }
}
