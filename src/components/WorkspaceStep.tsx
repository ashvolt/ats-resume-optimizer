import { useEffect, useState } from "react";
import type { Resume } from "../core/schema/resume";
import type { ResumeVersion } from "../core/schema/suggestion";
import type { UseAtsScore } from "../state/useAtsScore";
import type { UseSuggestions } from "../state/useSuggestions";
import type { UseProviderConfig } from "../state/useProviderConfig";
import { storage } from "../state/storage";
import { ScoreRing } from "./ScoreRing";
import { SuggestionCard } from "./SuggestionCard";
import { ProviderConfigPanel } from "./ProviderConfigPanel";

interface WorkspaceStepProps {
  resume: Resume;
  atsScore: UseAtsScore;
  suggestionsApi: UseSuggestions;
  providerApi: UseProviderConfig;
  onBack: () => void;
}

export function WorkspaceStep({ resume, atsScore, suggestionsApi, providerApi, onBack }: WorkspaceStepProps) {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const { score, deterministic, aiLoading: aiScoreLoading, aiError, runAiAnalysis } = atsScore;
  const { pending, aiLoading: suggestionsLoading, error: suggestionsError, requestAiSuggestions, accept, reject, refine } = suggestionsApi;
  const { activeAdapter, activeConfig } = providerApi;

  useEffect(() => {
    void storage.getAllByIndex("resumeVersions", "resumeId", resume.id).then((v) => setVersions(v.sort((a, b) => a.createdAt.localeCompare(b.createdAt))));
  }, [resume.id, resume.updatedAt]);

  const canUseAi = Boolean(activeAdapter && activeConfig);
  const busy = suggestionsLoading || aiScoreLoading;

  return (
    <div className="stack">
      <div className="row-between">
        <h2 style={{ margin: 0, fontSize: 15 }}>Review suggestions</h2>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Back
        </button>
      </div>

      <ProviderConfigPanel {...providerApi} />

      <div className="row-between">
        <span className="muted">{pending.length} pending suggestion(s)</span>
        <button
          className="btn btn-sm"
          disabled={!canUseAi || busy}
          title={canUseAi ? undefined : "Configure a provider above to enable AI suggestions"}
          onClick={() => activeAdapter && activeConfig && void requestAiSuggestions(activeAdapter, activeConfig)}
        >
          {suggestionsLoading ? "Asking the AI…" : "Get AI suggestions"}
        </button>
      </div>

      {suggestionsError && <div className="banner-error">{suggestionsError}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
        <div className="stack">
          {pending.length === 0 && <div className="card muted">No pending suggestions. Your resume already covers what the rules can check.</div>}
          {pending.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              busy={busy}
              onAccept={(sug) => void accept(sug)}
              onReject={(sug) => void reject(sug)}
              onRefine={canUseAi ? (sug, action) => activeAdapter && activeConfig && void refine(sug, action, activeAdapter, activeConfig) : undefined}
            />
          ))}
        </div>

        <div className="card stack" style={{ position: "sticky", top: 16 }}>
          <div className="row" style={{ justifyContent: "center" }}>
            <ScoreRing score={score?.score ?? 0} size={110} />
          </div>
          <div className="faint" style={{ textAlign: "center" }}>
            Coverage estimate — not a guarantee of passing any specific company's ATS.
          </div>

          {!activeAdapter ? null : (
            <button className="btn btn-sm" disabled={aiScoreLoading} onClick={() => activeAdapter && activeConfig && void runAiAnalysis(activeAdapter, activeConfig)}>
              {aiScoreLoading ? "Running AI analysis…" : score?.source === "deterministic+ai" ? "Re-run AI analysis" : "Run AI analysis"}
            </button>
          )}
          {aiError && <div className="banner-error">{aiError}</div>}

          <div>
            <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 6 }}>Top deductions</div>
            {(score?.deductions ?? [])
              .slice()
              .sort((a, b) => b.points - a.points)
              .slice(0, 5)
              .map((d) => (
                <div className="deduction-row" key={d.id}>
                  <span>{d.reason}</span>
                  <span className="pts mono">−{d.points}</span>
                </div>
              ))}
            {deterministic && deterministic.deductions.length === 0 && <div className="faint">No deductions — nice work.</div>}
          </div>

          {versions.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 6 }}>Version history</div>
              <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
                {versions.map((v, i) => (
                  <span key={v.id} className="mono" style={{ fontSize: 11 }}>
                    v{i + 1}: {v.atsScore.score}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
