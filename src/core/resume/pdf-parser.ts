/**
 * PDF -> Resume JSON via pdf.js text extraction. Implements the `ResumeParser` contract.
 *
 * Scope note (docs/architecture.md open question 1): this extracts a linear text stream per page
 * using pdf.js's line-break heuristic (`hasEOL`) and re-uses the same section/entry/bullet
 * heuristics as the plain-text parser. It does not attempt multi-column layout reconstruction —
 * a two-column resume will likely interleave columns. Always surfaced as a ParseWarning, never
 * silently trusted, per docs/features/resume-import.md FR-RES-4. Runs on the main thread (no
 * Web Worker) for simplicity; fine for typical 1-3 page resumes, a candidate follow-up for large
 * documents.
 */

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Resume } from "../schema/resume";
import type { ParseResult, ParseWarning, ResumeParser } from "./types";
import { extractMeta } from "./meta-extract";
import { buildSectionsFromLines } from "./build-sections";
import { renderMarkdown } from "../markdown/render";
import { generateId } from "../util/id";

const MIN_CONFIDENT_TEXT_LENGTH = 100;

interface PdfTextItem {
  str: string;
  hasEOL: boolean;
}

function isTextItem(item: object): item is PdfTextItem {
  return "str" in item;
}

async function extractLines(data: Uint8Array): Promise<string[]> {
  const doc = await getDocument({ data }).promise;
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    let currentLine = "";
    for (const item of content.items) {
      if (!isTextItem(item)) continue; // skip TextMarkedContent entries
      currentLine += item.str;
      if (item.hasEOL) {
        lines.push(currentLine);
        currentLine = "";
      }
    }
    if (currentLine.trim()) lines.push(currentLine);
  }
  return lines;
}

export class PdfResumeParser implements ResumeParser {
  readonly acceptedTypes = ["application/pdf", ".pdf"];

  async parse(input: File | string): Promise<ParseResult> {
    if (typeof input === "string") {
      throw new TypeError("PdfResumeParser expects a File/Blob, not a string.");
    }

    const buffer = await input.arrayBuffer();
    const warnings: ParseWarning[] = [];
    const lines = await extractLines(new Uint8Array(buffer));
    const fullText = lines.join("\n");

    if (fullText.trim().length < MIN_CONFIDENT_TEXT_LENGTH) {
      warnings.push({
        severity: "warning",
        message:
          "Very little text could be extracted from this PDF. It may be a scanned/image-based document, which isn't supported — try Markdown or plain text instead.",
      });
    } else {
      warnings.push({
        severity: "info",
        message:
          "PDF layout (columns, tables) isn't analyzed — section detection uses the same heuristics as plain-text import. Please review the structure below.",
      });
    }

    const meta = extractMeta(fullText);
    const { sections, warnings: sectionWarnings } = buildSectionsFromLines(lines);
    warnings.push(...sectionWarnings);

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
