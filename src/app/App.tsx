import { useState } from "react";
import { useJobDescription } from "../state/useJobDescription";
import { useResume } from "../state/useResume";
import { useAtsScore } from "../state/useAtsScore";
import { useSuggestions } from "../state/useSuggestions";
import { useProviderConfig } from "../state/useProviderConfig";
import { JdImportStep } from "../components/JdImportStep";
import { ResumeImportStep } from "../components/ResumeImportStep";
import { WorkspaceStep } from "../components/WorkspaceStep";

type Step = "jd" | "resume" | "workspace";
const STEPS: Step[] = ["jd", "resume", "workspace"];

export function App() {
  const [step, setStep] = useState<Step>("jd");
  const jdApi = useJobDescription();
  const resumeApi = useResume();
  const atsScore = useAtsScore(resumeApi.resume, jdApi.jd);
  const suggestionsApi = useSuggestions(resumeApi.resume, jdApi.jd, atsScore.deterministic, resumeApi.setResume);
  const providerApi = useProviderConfig();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Resume Optimizer</h1>
        <div className="step-progress" aria-label={`Step ${STEPS.indexOf(step) + 1} of ${STEPS.length}`}>
          {STEPS.map((s) => (
            <span key={s} className={`step-dot${s === step ? " is-active" : STEPS.indexOf(s) < STEPS.indexOf(step) ? " is-done" : ""}`} />
          ))}
        </div>
      </header>

      {step === "jd" && <JdImportStep {...jdApi} onContinue={() => setStep("resume")} />}

      {step === "resume" && <ResumeImportStep {...resumeApi} onContinue={() => setStep("workspace")} onBack={() => setStep("jd")} />}

      {step === "workspace" && resumeApi.resume && jdApi.jd && (
        <WorkspaceStep resume={resumeApi.resume} atsScore={atsScore} suggestionsApi={suggestionsApi} providerApi={providerApi} onBack={() => setStep("resume")} />
      )}
    </div>
  );
}
