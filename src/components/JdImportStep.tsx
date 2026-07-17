import { useState } from "react";
import type { UseJobDescription } from "../state/useJobDescription";

type Tab = "paste" | "url";

interface JdImportStepProps extends UseJobDescription {
  onContinue: () => void;
}

export function JdImportStep({ jd, importText, importUrl, editRawText, onContinue }: JdImportStepProps) {
  const [tab, setTab] = useState<Tab>("paste");
  const [draft, setDraft] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePaste = () => {
    if (draft.trim().length === 0) return;
    setError(null);
    importText(draft);
  };

  const handleUrl = async () => {
    if (url.trim().length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await importUrl(url);
    } catch (err) {
      // FR-JD-3: scraping failure degrades to the paste tab, never a silent empty result.
      setError(err instanceof Error ? err.message : "Couldn't fetch that URL.");
      setTab("paste");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card stack">
      <div className="row-between">
        <h2 style={{ margin: 0, fontSize: 15 }}>Job description</h2>
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={tab === "paste"} onClick={() => setTab("paste")}>
            Paste text
          </button>
          <button className="tab" role="tab" aria-selected={tab === "url"} onClick={() => setTab("url")}>
            From URL
          </button>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {tab === "paste" ? (
        <div className="stack">
          <textarea
            className="big"
            placeholder="Paste the full job posting — include Requirements/Responsibilities for the best score."
            value={jd ? jd.rawText : draft}
            onChange={(e) => (jd ? editRawText(e.target.value) : setDraft(e.target.value))}
          />
          {!jd && (
            <button className="btn btn-primary" style={{ alignSelf: "flex-end" }} onClick={handlePaste}>
              Parse job description
            </button>
          )}
        </div>
      ) : (
        <div className="row">
          <input
            type="text"
            style={{ flex: 1 }}
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="btn btn-primary" disabled={loading} onClick={handleUrl}>
            {loading ? "Fetching…" : "Fetch"}
          </button>
        </div>
      )}

      {jd && (
        <div className="stack">
          <div className="faint">
            Detected — {jd.structured.role ?? "role unspecified"} · {jd.structured.sections.length} section(s) · language: {jd.language}
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 7 }}>
            {jd.keywords.slice(0, 12).map((k) => (
              <span className="chip" key={k.term}>
                {k.term} <b className="mono">{k.category}</b>
              </span>
            ))}
          </div>
          <button className="btn btn-primary" style={{ alignSelf: "flex-end" }} onClick={onContinue}>
            Looks right, continue →
          </button>
        </div>
      )}
    </div>
  );
}
