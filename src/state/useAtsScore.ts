import { useCallback, useMemo, useState } from "react";
import type { Resume } from "../core/schema/resume";
import type { JobDescription } from "../core/schema/job-description";
import type { AtsScoreResult } from "../core/ats/types";
import type { ProviderAdapter, ProviderConfig } from "../core/providers/types";
import { scoreResume } from "../core/ats/score";
import { scoreResumeWithAi } from "../core/ats/ai-layer";

export interface UseAtsScore {
  /** The deterministic result, always available with no network call (FR-ATS-1). */
  deterministic: AtsScoreResult | null;
  /** AI-extended result once `runAiAnalysis` succeeds; deterministic keeps rendering if this is null. */
  aiResult: AtsScoreResult | null;
  /** The result to render: AI-extended when available, deterministic otherwise. */
  score: AtsScoreResult | null;
  aiLoading: boolean;
  aiError: string | null;
  runAiAnalysis: (adapter: ProviderAdapter, config: ProviderConfig) => Promise<void>;
  /** Call after any resume mutation outside the accept flow, so a stale AI result never lingers. */
  resetAiResult: () => void;
}

/**
 * Subscribes to both a Resume and a JobDescription (per docs/architecture.md §9) rather than
 * owning either — this is exactly the cross-domain derived state the architecture calls out as
 * the reason `useAtsScore` is its own hook.
 */
export function useAtsScore(resume: Resume | null, jd: JobDescription | null): UseAtsScore {
  const [aiResult, setAiResult] = useState<AtsScoreResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const deterministic = useMemo(() => (resume && jd ? scoreResume(resume, jd) : null), [resume, jd]);

  const resetAiResult = useCallback(() => {
    setAiResult(null);
    setAiError(null);
  }, []);

  const runAiAnalysis = useCallback(
    async (adapter: ProviderAdapter, config: ProviderConfig) => {
      if (!resume || !jd) return;
      setAiLoading(true);
      setAiError(null);
      try {
        const result = await scoreResumeWithAi(resume, jd, adapter, config);
        setAiResult(result);
      } catch (err) {
        // Deterministic result stays on screen regardless — see ats-engine.md's AI-layer-failure edge case.
        setAiError(err instanceof Error ? err.message : "AI analysis failed.");
      } finally {
        setAiLoading(false);
      }
    },
    [resume, jd],
  );

  return { deterministic, aiResult, score: aiResult ?? deterministic, aiLoading, aiError, runAiAnalysis, resetAiResult };
}
