import { afterEach, describe, expect, test, vi } from "vitest";
import { HttpJdScraper, JdScrapeException } from "./scraper";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("HttpJdScraper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("short-circuits known-blocked hosts without making a network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const scraper = new HttpJdScraper();
    await expect(scraper.scrape("https://www.linkedin.com/jobs/view/123")).rejects.toMatchObject({
      error: { kind: "blocked" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("extracts JD text from the first proxy that returns usable content", async () => {
    const html = `<html><body><main>${"Senior Engineer role. ".repeat(20)}</main></body></html>`;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ contents: html }));
    vi.stubGlobal("fetch", fetchMock);

    const scraper = new HttpJdScraper();
    const text = await scraper.scrape("https://boards.greenhouse.io/acme/jobs/1");
    expect(text).toContain("Senior Engineer role");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("falls back to the next proxy when the first returns an empty result", async () => {
    const html = `<html><body><main>${"Backend role requiring Go. ".repeat(20)}</main></body></html>`;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ contents: "" }))
      .mockResolvedValueOnce(jsonResponse({ contents: html }));
    vi.stubGlobal("fetch", fetchMock);

    const scraper = new HttpJdScraper();
    const text = await scraper.scrape("https://jobs.lever.co/acme/1");
    expect(text).toContain("Backend role");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("throws a typed error when every proxy fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const scraper = new HttpJdScraper();
    await expect(scraper.scrape("https://careers.example.com/job/1")).rejects.toBeInstanceOf(JdScrapeException);
  });
});
