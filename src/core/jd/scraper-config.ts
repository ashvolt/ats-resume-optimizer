/**
 * Scraping configuration: proxy fallback chain, per-ATS selectors, and hosts known to block
 * scraping outright. Ported from ats-resume-builder.jsx / DEVELOPMENT_PLAN.md §3.
 */

export const PROXIES: ReadonlyArray<(url: string) => string> = [
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url) => `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

/** Priority selectors for major ATS platforms, falling back to generic containers. */
export const JD_SELECTORS: readonly string[] = [
  '[class*="job-post-description"]', // Greenhouse
  '[class*="posting-body"]', // Lever
  "#jobDescriptionText", // Indeed
  '[data-automation-id="job-posting-details"]', // Workday
  '[class*="ashby-job-posting"]', // Ashby
  '[class*="BambooHR-ATS"]', // BambooHR
  '[class*="job-description"]',
  '[class*="jobDescription"]',
  '[id*="description"]',
  "article",
  "main",
];

/** Hosts that reliably block or JS-render past what a CORS proxy can retrieve. */
export const BLOCKED_HOSTS: readonly string[] = [
  "linkedin.com",
  "glassdoor.com",
  "myworkdayjobs.com",
  "workday.com",
];

export function isBlockedHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOSTS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
  } catch {
    return false;
  }
}
