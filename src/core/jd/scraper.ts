/**
 * Two-proxy-fallback JD scraper. Implements the `JdScraper` contract in ./types.ts.
 * See docs/features/jd-parser.md.
 */

import type { JdScrapeError, JdScraper } from "./types";
import { BLOCKED_HOSTS, JD_SELECTORS, PROXIES, isBlockedHost } from "./scraper-config";
import { cleanJdText } from "./clean";
import { extractProxyContents, extractReadableJDText } from "./extract";

export class JdScrapeException extends Error {
  constructor(public readonly error: JdScrapeError) {
    super(error.message);
    this.name = "JdScrapeException";
  }
}

function stripNoise(doc: Document): void {
  for (const tag of ["script", "style", "nav", "footer", "header", "aside", "form"]) {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  }
}

function extractFromHtml(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  stripNoise(doc);

  for (const selector of JD_SELECTORS) {
    const el = doc.querySelector(selector);
    const text = el?.textContent?.trim() ?? "";
    if (text.length > 300) return cleanJdText(text);
  }

  const bodyText = doc.body?.textContent?.trim() ?? "";
  if (bodyText.length > 200) return cleanJdText(bodyText);
  return null;
}

export class HttpJdScraper implements JdScraper {
  async scrape(url: string, opts?: { timeoutMs?: number }): Promise<string> {
    if (isBlockedHost(url)) {
      throw new JdScrapeException({
        kind: "blocked",
        message: `${new URL(url).hostname} blocks automated scraping (known hosts: ${BLOCKED_HOSTS.join(", ")}). Paste the JD text directly.`,
      });
    }

    const timeoutMs = opts?.timeoutMs ?? 10000;
    let lastError = "Unknown error";

    for (const makeProxyUrl of PROXIES) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(makeProxyUrl(url), { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) {
          lastError = `HTTP ${resp.status}`;
          continue;
        }

        const text = await resp.text();
        const contents = extractProxyContents(text, resp.headers.get("content-type") ?? "");
        if (!contents || contents.length < 200) {
          lastError = "Empty response";
          continue;
        }

        const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(contents);
        if (looksLikeHtml) {
          const extracted = extractFromHtml(contents);
          if (extracted) return extracted;
        }

        const readable = extractReadableJDText(contents);
        if (readable.length > 200) return cleanJdText(readable);

        lastError = "No job content found in page";
      } catch (err) {
        clearTimeout(timer);
        // A real fetch() abort throws a DOMException named "AbortError" — DOMException does not
        // extend Error in Node, so this must check `.name` directly rather than `instanceof Error`.
        const isAbort = Boolean(err && typeof err === "object" && "name" in err && err.name === "AbortError");
        lastError = isAbort ? `Timed out after ${timeoutMs}ms` : String(err);
      }
    }

    const kind: JdScrapeError["kind"] = lastError.startsWith("Timed out")
      ? "timeout"
      : lastError === "Empty response"
        ? "empty_result"
        : "network";
    throw new JdScrapeException({
      kind,
      message: `All proxies failed (${lastError}). Paste the JD text directly.`,
    });
  }
}
