import type { ParseResult, ResumeParser } from "./types";
import { parseMarkdown } from "../markdown/parse";

export class MarkdownResumeParser implements ResumeParser {
  readonly acceptedTypes = ["text/markdown", ".md"];

  async parse(input: File | string): Promise<ParseResult> {
    const markdown = typeof input === "string" ? input : await input.text();
    return parseMarkdown(markdown);
  }
}
