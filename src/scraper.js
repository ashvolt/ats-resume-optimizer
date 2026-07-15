export function extractProxyContents(payload, contentType = "") {
  if (!payload) return "";
  const text = String(payload).trim();
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return parsed.contents || parsed.body || parsed.text || "";
    }
  } catch {
    // fall through to plain text handling
  }

  if (contentType.includes("json") && text.startsWith("{")) {
    return "";
  }

  return text;
}

export function extractReadableJDText(raw) {
  return raw
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
