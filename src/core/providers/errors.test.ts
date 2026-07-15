import { describe, expect, test } from "vitest";
import { ProviderException, httpStatusToProviderError, withTimeout } from "./errors";

describe("httpStatusToProviderError", () => {
  test.each([
    [401, "auth"],
    [403, "auth"],
    [429, "rate_limit"],
    [404, "model_not_found"],
    [500, "unknown"],
  ])("maps HTTP %i to kind %s", (status, kind) => {
    expect(httpStatusToProviderError(status, "").kind).toBe(kind);
  });

  test("maps a 400 mentioning content filtering to content_filtered", () => {
    expect(httpStatusToProviderError(400, '{"error":"content_filter triggered"}').kind).toBe("content_filtered");
  });
});

describe("withTimeout", () => {
  test("resolves normally when the function completes in time", async () => {
    const result = await withTimeout(async () => "ok", 1000);
    expect(result).toBe("ok");
  });

  test("maps an abort into a typed timeout ProviderException", async () => {
    const never = (signal: AbortSignal) =>
      new Promise<string>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });

    await expect(withTimeout(never, 20)).rejects.toMatchObject({
      error: { kind: "timeout" },
    });
  });

  test("wraps a network failure as a ProviderException with kind network", async () => {
    await expect(
      withTimeout(async () => {
        throw new TypeError("Failed to fetch");
      }, 1000),
    ).rejects.toBeInstanceOf(ProviderException);
  });

  test("passes an already-typed ProviderException straight through", async () => {
    await expect(
      withTimeout(async () => {
        throw new ProviderException({ kind: "auth", message: "bad key" });
      }, 1000),
    ).rejects.toMatchObject({ error: { kind: "auth" } });
  });
});
