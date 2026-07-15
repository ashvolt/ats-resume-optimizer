import { test, expect } from "vitest";
import { extractProxyContents, extractReadableJDText } from "../src/scraper.js";

test("extractProxyContents reads allorigins-style JSON payloads", () => {
  const payload = JSON.stringify({ contents: "<html><body><main><p>Senior React engineer</p></main></body></html>" });
  expect(extractProxyContents(payload, "application/json")).toBe(
    "<html><body><main><p>Senior React engineer</p></main></body></html>",
  );
});

test("extractProxyContents preserves plain text payloads from markdown proxies", () => {
  const payload = "Title: Senior Backend Engineer\n\nWe are looking for a Go engineer with Kubernetes experience.";
  expect(extractProxyContents(payload, "text/plain")).toBe(payload);
});

test("extractReadableJDText strips markdown formatting and keeps the job text", () => {
  const text = "## Senior Backend Engineer\nWe are looking for a **Go** engineer with Kubernetes experience.";
  const result = extractReadableJDText(text);
  expect(result).toMatch(/Senior Backend Engineer/);
  expect(result).toMatch(/Go engineer/);
  expect(result).not.toMatch(/\*\*/);
});
