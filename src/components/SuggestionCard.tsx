import type { Suggestion } from "../core/schema/suggestion";
import type { RefinementAction } from "../core/suggestions/types";

const REFINE_LABELS: Record<RefinementAction, string> = {
  regenerate: "Regenerate",
  shorten: "Shorten",
  expand: "Expand",
  more_professional: "More professional",
  more_ats_focused: "More ATS-focused",
  more_human: "More human",
  explain_reasoning: "Explain reasoning",
};

interface SuggestionCardProps {
  suggestion: Suggestion;
  busy?: boolean;
  onAccept: (s: Suggestion) => void;
  onReject: (s: Suggestion) => void;
  onRefine?: (s: Suggestion, action: RefinementAction) => void;
}

export function SuggestionCard({ suggestion, busy, onAccept, onReject, onRefine }: SuggestionCardProps) {
  const isResolved = suggestion.status !== "pending";
  const flagged = (suggestion.flaggedTerms?.length ?? 0) > 0;

  return (
    <div className={`card suggestion-card${flagged ? " is-flagged" : ""}${isResolved ? " is-resolved" : ""}`}>
      <div className="row-between">
        <span className={`badge ${suggestion.source === "ai" ? "badge-ai" : "badge-rule"}`}>
          {suggestion.source === "ai" ? "AI" : "Rule-based"} · {suggestion.kind.replace("-", " ")}
        </span>
        {isResolved && <span className={`badge ${suggestion.status === "accepted" ? "badge-good" : "badge-rule"}`}>{suggestion.status}</span>}
      </div>

      <div className="diff">
        <div className="line del">
          <span className="marker">−</span>
          <span>{suggestion.original}</span>
        </div>
        <div className="line add">
          <span className="marker">+</span>
          <span>{suggestion.proposed}</span>
        </div>
      </div>

      <div className="sc-reason">{suggestion.reason}</div>

      {flagged && (
        <div className="flag-note">
          <b>
            {suggestion.flaggedTerms!.map((t) => `"${t}"`).join(", ")} {suggestion.flaggedTerms!.length === 1 ? "isn't" : "aren't"} in your resume or
            this job description.
          </b>{" "}
          Verify before accepting — the AI may be extrapolating.
        </div>
      )}

      {!isResolved && (
        <div className="sc-actions">
          <div className="sc-actions-left">
            <button className={`btn btn-sm ${flagged ? "btn-danger-ghost" : "btn-primary"}`} disabled={busy} onClick={() => onAccept(suggestion)}>
              {flagged ? "Accept anyway" : "Accept"}
            </button>
            <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => onReject(suggestion)}>
              Reject
            </button>
          </div>
          {onRefine && suggestion.source === "ai" && (
            <select
              className="btn btn-sm btn-ghost"
              disabled={busy}
              defaultValue=""
              aria-label="Refine this suggestion"
              onChange={(e) => {
                const action = e.target.value as RefinementAction;
                if (action) onRefine(suggestion, action);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                More options ▾
              </option>
              {(Object.keys(REFINE_LABELS) as RefinementAction[]).map((action) => (
                <option key={action} value={action}>
                  {REFINE_LABELS[action]}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
