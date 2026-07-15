/** Proxy response unwrapping + markdown-ish plaintext cleanup, typed port of src/scraper.js. */

export function extractProxyContents(payload: unknown, contentType = ""): string {
  if (!payload) return "";
  const text = String(payload).trim();
  if (!text) return "";

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const contents = obj.contents ?? obj.body ?? obj.text;
      if (typeof contents === "string") return contents;
    }
  } catch {
    // not JSON — fall through to plain text handling
  }

  if (contentType.includes("json") && text.startsWith("{")) return "";
  return text;
}

export function extractReadableJDText(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
