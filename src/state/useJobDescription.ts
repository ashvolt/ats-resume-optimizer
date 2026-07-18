import { useCallback, useState } from "react";
import type { JobDescription } from "../core/schema/job-description";
import { parseJd } from "../core/jd/parse";
import { HttpJdScraper } from "../core/jd/scraper";
import { storage } from "./storage";

const scraper = new HttpJdScraper();

export interface UseJobDescription {
  jd: JobDescription | null;
  /** FR-JD-1: paste raw JD text. */
  importText: (text: string) => JobDescription;
  /** FR-JD-2/3: scrape a URL; throws JdScrapeException on failure — caller must offer the paste fallback. */
  importUrl: (url: string) => Promise<JobDescription>;
  /** FR-JD-7: user can edit the cleaned JD text before analysis — re-parses in place. */
  editRawText: (text: string) => JobDescription;
}

export function useJobDescription(): UseJobDescription {
  const [jd, setJd] = useState<JobDescription | null>(null);

  const commit = useCallback((parsed: JobDescription) => {
    setJd(parsed);
    void storage.put("jobDescriptions", parsed);
    return parsed;
  }, []);

  const importText = useCallback((text: string) => commit(parseJd(text, { type: "paste" })), [commit]);

  const importUrl = useCallback(
    async (url: string) => {
      const rawText = await scraper.scrape(url);
      return commit(parseJd(rawText, { type: "url", url, scrapedAt: new Date().toISOString() }));
    },
    [commit],
  );

  const editRawText = useCallback(
    (text: string) => commit(parseJd(text, jd?.source ?? { type: "paste" })),
    [commit, jd],
  );

  return { jd, importText, importUrl, editRawText };
}
