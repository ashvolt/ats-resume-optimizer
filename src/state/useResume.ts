import { useCallback, useState } from "react";
import type { Resume } from "../core/schema/resume";
import type { ParseResult, ParseWarning } from "../core/resume/types";
import { TextResumeParser } from "../core/resume/text-parser";
import { MarkdownResumeParser } from "../core/resume/markdown-parser";
import { PdfResumeParser } from "../core/resume/pdf-parser";
import { storage } from "./storage";

const textParser = new TextResumeParser();
const markdownParser = new MarkdownResumeParser();
const pdfParser = new PdfResumeParser();

function parserFor(file: File) {
  if (file.name.endsWith(".pdf") || file.type === "application/pdf") return pdfParser;
  if (file.name.endsWith(".md") || file.type === "text/markdown") return markdownParser;
  return textParser;
}

export interface UseResume {
  resume: Resume | null;
  /** Non-empty only right after an import — surfaced for confirmation per FR-RES-4, never auto-dismissed. */
  warnings: ParseWarning[];
  /** FR-RES-1: paste plain resume text. */
  importText: (text: string) => Promise<Resume>;
  /** FR-RES-2/3: upload a Markdown or PDF file (routed by extension/MIME type). */
  importFile: (file: File) => Promise<Resume>;
  /** Direct mutation (manual hand-edit, or applied by the suggestion engine) — always the source of truth going forward. */
  setResume: (resume: Resume) => void;
}

export function useResume(): UseResume {
  const [resume, setResumeState] = useState<Resume | null>(null);
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);

  const commit = useCallback(({ resume: parsed, warnings: w }: ParseResult) => {
    setResumeState(parsed);
    setWarnings(w);
    void storage.put("resumes", parsed);
    return parsed;
  }, []);

  const importText = useCallback((text: string) => textParser.parse(text).then(commit), [commit]);
  const importFile = useCallback((file: File) => parserFor(file).parse(file).then(commit), [commit]);

  const setResume = useCallback((next: Resume) => {
    setResumeState(next);
    void storage.put("resumes", next);
  }, []);

  return { resume, warnings, importText, importFile, setResume };
}
