import type { ProviderError } from "./types";

export class ProviderException extends Error {
  constructor(public readonly error: ProviderError) {
    super(error.message);
    this.name = "ProviderException";
  }
}

/** Best-effort mapping from HTTP status + body onto the shared ProviderError taxonomy. */
export function httpStatusToProviderError(status: number, bodyText: string): ProviderError {
  if (status === 401 || status === 403) {
    return { kind: "auth", message: `Authentication failed (HTTP ${status}). Check your API key.` };
  }
  if (status === 429) {
    return { kind: "rate_limit", message: "Rate limit exceeded. Wait a moment and try again." };
  }
  if (status === 404) {
    return { kind: "model_not_found", message: `Model not found (HTTP 404): ${bodyText.slice(0, 200)}` };
  }
  if (status === 400 && /content.?filter|safety/i.test(bodyText)) {
    return { kind: "content_filtered", message: "The request was blocked by the provider's content filter." };
  }
  return { kind: "unknown", message: `Provider request failed (HTTP ${status}): ${bodyText.slice(0, 200)}`, raw: bodyText };
}

/**
 * Runs `fn` with an AbortSignal that fires after `timeoutMs`, normalizing every failure mode
 * (abort, network failure, a ProviderException thrown inside `fn`) onto ProviderException.
 */
export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (err instanceof ProviderException) throw err;
    // A real fetch() abort throws a DOMException named "AbortError" — DOMException does not
    // extend Error in Node, so this must check `.name` directly rather than `instanceof Error`.
    if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
      throw new ProviderException({ kind: "timeout", message: `Request timed out after ${timeoutMs}ms.` });
    }
    throw new ProviderException({ kind: "network", message: err instanceof Error ? err.message : String(err) });
  } finally {
    clearTimeout(timer);
  }
}
