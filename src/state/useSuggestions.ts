import { useCallback, useEffect, useMemo, useState } from "react";
import type { Resume } from "../core/schema/resume";
import type { JobDescription } from "../core/schema/job-description";
import type { AtsScoreResult } from "../core/ats/types";
import type { ProviderAdapter, ProviderConfig } from "../core/providers/types";
import type { Suggestion } from "../core/schema/suggestion";
import type { RefinementAction } from "../core/suggestions/types";
import { generateDeterministicSuggestions } from "../core/suggestions/deterministic";
import { generateAiSuggestions, refineSuggestion as aiRefineSuggestion } from "../core/suggestions/ai";
import {
  acceptSuggestion as coreAcceptSuggestion,
  rejectSuggestion as coreRejectSuggestion,
  findStaleSuggestions,
  StaleSuggestionError,
} from "../core/suggestions/state";
import { storage } from "./storage";

export interface UseSuggestions {
  suggestions: Suggestion[];
  pending: Suggestion[];
  aiLoading: boolean;
  error: string | null;
  /** Regenerates the rule-based suggestion set from the current resume + deterministic score. */
  regenerateDeterministic: () => void;
  requestAiSuggestions: (adapter: ProviderAdapter, config: ProviderConfig) => Promise<void>;
  accept: (suggestion: Suggestion) => Promise<void>;
  reject: (suggestion: Suggestion) => Promise<void>;
  refine: (suggestion: Suggestion, action: RefinementAction, adapter: ProviderAdapter, config: ProviderConfig) => Promise<void>;
}

export function useSuggestions(
  resume: Resume | null,
  jd: JobDescription | null,
  deterministicScore: AtsScoreResult | null,
  onResumeChange: (resume: Resume) => void,
): UseSuggestions {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = useMemo(() => suggestions.filter((s) => s.status === "pending"), [suggestions]);

  const upsertMany = useCallback((next: Suggestion[]) => {
    setSuggestions((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      for (const s of next) byId.set(s.id, s);
      return Array.from(byId.values());
    });
  }, []);

  const regenerateDeterministic = useCallback(() => {
    if (!resume || !deterministicScore) return;
    const generated = generateDeterministicSuggestions(resume, deterministicScore);
    // Replace the prior deterministic *pending* batch rather than piling up duplicates on re-score;
    // already-resolved (accepted/rejected) records are kept for the audit trail.
    setSuggestions((prev) => [...prev.filter((s) => !(s.source === "deterministic" && s.status === "pending")), ...generated]);
  }, [resume, deterministicScore]);

  // Re-run whenever a fresh resume/score pair arrives (import, or after an accept triggers a re-score).
  useEffect(() => {
    regenerateDeterministic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume?.id, resume?.updatedAt, deterministicScore?.computedAt]);

  // Manual edits invalidate any pending suggestion whose target text moved out from under it
  // (docs/features/resume-editor.md edge case) — drop them rather than let them go stale silently.
  useEffect(() => {
    if (!resume) return;
    const stale = findStaleSuggestions(resume, pending);
    if (stale.length === 0) return;
    const staleIds = new Set(stale.map((s) => s.id));
    setSuggestions((prev) => prev.map((s) => (staleIds.has(s.id) ? { ...s, status: "rejected", resolvedAt: new Date().toISOString() } : s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  const requestAiSuggestions = useCallback(
    async (adapter: ProviderAdapter, config: ProviderConfig) => {
      if (!resume || !jd || !deterministicScore) return;
      setAiLoading(true);
      setError(null);
      try {
        const generated = await generateAiSuggestions(resume, jd, deterministicScore, adapter, config);
        upsertMany(generated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI suggestion generation failed.");
      } finally {
        setAiLoading(false);
      }
    },
    [resume, jd, deterministicScore, upsertMany],
  );

  const accept = useCallback(
    async (suggestion: Suggestion) => {
      if (!resume || !jd) return;
      setError(null);
      try {
        const result = await coreAcceptSuggestion(suggestion, resume, jd, pending, storage);
        if (!result) return; // already resolved — idempotent no-op
        onResumeChange(result.resume);
        upsertMany([{ ...suggestion, status: "accepted", resolvedAt: new Date().toISOString() }, ...result.invalidated]);
      } catch (err) {
        if (err instanceof StaleSuggestionError) {
          upsertMany([{ ...suggestion, status: "rejected", resolvedAt: new Date().toISOString() }]);
          setError(`"${suggestion.original.slice(0, 40)}…" was edited since this suggestion was made — it was dropped instead of applied.`);
          return;
        }
        setError(err instanceof Error ? err.message : "Couldn't accept that suggestion.");
      }
    },
    [resume, jd, pending, onResumeChange, upsertMany],
  );

  const reject = useCallback(
    async (suggestion: Suggestion) => {
      const rejected = await coreRejectSuggestion(suggestion, storage);
      upsertMany([rejected]);
    },
    [upsertMany],
  );

  const refine = useCallback(
    async (suggestion: Suggestion, action: RefinementAction, adapter: ProviderAdapter, config: ProviderConfig) => {
      if (!resume || !jd) return;
      setAiLoading(true);
      setError(null);
      try {
        const refined = await aiRefineSuggestion(suggestion, action, resume, jd, adapter, config);
        // Superseded by the fresh proposal — reject the original so only one live card targets this bullet.
        const supersededOriginal = await coreRejectSuggestion(suggestion, storage);
        upsertMany([supersededOriginal, refined]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't refine that suggestion.");
      } finally {
        setAiLoading(false);
      }
    },
    [resume, jd, upsertMany],
  );

  return { suggestions, pending, aiLoading, error, regenerateDeterministic, requestAiSuggestions, accept, reject, refine };
}
