import { useRef, useState } from "react";
import type { UseResume } from "../state/useResume";

interface ResumeImportStepProps extends UseResume {
  onContinue: () => void;
  onBack: () => void;
}

export function ResumeImportStep({ resume, warnings, importText, importFile, onContinue, onBack }: ResumeImportStepProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      await importFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card stack">
      <div className="row-between">
        <h2 style={{ margin: 0, fontSize: 15 }}>Your resume</h2>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Back
        </button>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {!resume && (
        <div className="stack">
          <div
            className="drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
          >
            Drop a PDF or Markdown file, or{" "}
            <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
              choose a file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.md,text/markdown,application/pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
          <div className="muted">or paste plain text below</div>
          <textarea className="big" placeholder="Paste your resume text…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button
            className="btn btn-primary"
            style={{ alignSelf: "flex-end" }}
            disabled={loading || draft.trim().length === 0}
            onClick={() => void importText(draft)}
          >
            {loading ? "Parsing…" : "Parse resume"}
          </button>
        </div>
      )}

      {resume && (
        <div className="stack">
          <div className="faint">
            {resume.meta.name} · {resume.sections.length} section(s) detected
          </div>
          <ul className="checklist">
            {resume.sections.map((s) => (
              <li key={s.id}>
                <span style={{ color: "var(--color-text-success)" }}>✓</span> {s.title} — {s.entries.length} entr{s.entries.length === 1 ? "y" : "ies"}
              </li>
            ))}
          </ul>
          {warnings.length > 0 && (
            <ul className="checklist">
              {warnings.map((w, i) => (
                <li key={i} className="muted">
                  {w.severity === "warning" ? "⚠" : "ℹ"} {w.message}
                </li>
              ))}
            </ul>
          )}
          <button className="btn btn-primary" style={{ alignSelf: "flex-end" }} onClick={onContinue}>
            Confirm structure →
          </button>
        </div>
      )}
    </div>
  );
}
