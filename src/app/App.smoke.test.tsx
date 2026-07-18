/**
 * End-to-end wiring smoke test: drives the real <App/> — JD paste, resume paste, and the
 * suggestion accept flow — through actual DOM events against the real core/* modules and
 * IndexedDB (fake-indexeddb in this environment). No mocks of core/state — this is what proves
 * the UI wiring, not just the core logic (already covered exhaustively under core/*'s own tests).
 */
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { App } from "./App";

// React 18's act() only suppresses its "not wrapped in act" warning and flushes synchronously
// when this flag is set — without it, updates from awaited async work (like acceptSuggestion's
// storage.put chain) can land after act() already returned.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function waitFor(predicate: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: condition never became true");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

const JD_TEXT = [
  "Senior Backend Engineer",
  "Requirements",
  "5+ years of TypeScript and Kubernetes experience required.",
  "Strong knowledge of Docker required.",
].join("\n");

const RESUME_TEXT = [
  "Ada Lovelace",
  "ada@example.com",
  "",
  "SUMMARY",
  "Engineer with a passion for distributed systems.",
  "",
  "EXPERIENCE",
  "Senior Engineer, Acme Corp",
  "Jan 2022 - Present",
  "- Used TypeScript to build scalable APIs.",
  "- Reduced latency by 30%.",
  "",
  "SKILLS",
  "TypeScript, Docker",
  "",
  "EDUCATION",
  "BS Computer Science",
].join("\n");

function setValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function clickByText(container: HTMLElement, text: string) {
  const el = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(text));
  if (!el) throw new Error(`No button found with text "${text}" (available: ${Array.from(container.querySelectorAll("button")).map((b) => b.textContent).join(" | ")})`);
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("App wiring (smoke)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
      root.render(<App />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("carries a JD and resume through to the workspace, scores it, and accepts a suggestion", async () => {
    // Step 1: JD paste
    const jdTextarea = container.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => setValue(jdTextarea, JD_TEXT));
    await act(async () => clickByText(container, "Parse job description"));

    expect(container.textContent).toContain("Detected");
    await act(async () => clickByText(container, "Looks right, continue"));

    // Step 2: resume paste
    const resumeTextarea = Array.from(container.querySelectorAll("textarea")).at(-1) as HTMLTextAreaElement;
    await act(async () => setValue(resumeTextarea, RESUME_TEXT));
    await act(async () => clickByText(container, "Parse resume"));

    expect(container.textContent).toContain("Ada Lovelace");
    await act(async () => clickByText(container, "Confirm structure"));

    // Step 3: workspace — deterministic suggestions should have generated with no AI provider.
    const scoreRing = container.querySelector('[role="img"][aria-label*="ATS score"]');
    expect(scoreRing).not.toBeNull();
    expect(scoreRing?.getAttribute("aria-label")).toMatch(/\d+ out of 100/);

    const suggestionCards = container.querySelectorAll(".suggestion-card");
    expect(suggestionCards.length).toBeGreaterThan(0); // missing "kubernetes" keyword + weak verb "Used"

    const scoreBefore = scoreRing?.getAttribute("aria-label");
    const pendingCountBefore = container.querySelectorAll(".suggestion-card").length;

    // Accept the first pending suggestion end-to-end.
    const firstAccept = container.querySelector(".suggestion-card button.btn-primary, .suggestion-card button.btn-danger-ghost") as HTMLButtonElement;
    expect(firstAccept).not.toBeNull();
    await act(async () => {
      firstAccept.click();
    });

    // Accepting removes the suggestion from the pending list (WorkspaceStep only ever renders
    // `pending`) and re-scores exactly once — both are the observable proof the wiring works.
    await waitFor(() => container.querySelectorAll(".suggestion-card").length < pendingCountBefore);

    const scoreAfter = container.querySelector('[role="img"][aria-label*="ATS score"]')?.getAttribute("aria-label");
    expect(scoreAfter).toBeDefined();
    expect(scoreAfter).not.toBe(scoreBefore); // re-scored after the accept

    // A ResumeVersion was recorded for the accept (fetched async by WorkspaceStep).
    await waitFor(() => container.textContent?.includes("Version history") ?? false);
  });
});
