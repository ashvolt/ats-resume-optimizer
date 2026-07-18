import { useState } from "react";
import type { UseProviderConfig } from "../state/useProviderConfig";

export function ProviderConfigPanel({ configs, activeConfig, availableAdapters, saveConfig, removeConfig, setActiveProviderId }: UseProviderConfig) {
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState(availableAdapters[0]?.id ?? "");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");

  const adapter = availableAdapters.find((a) => a.id === providerId);

  return (
    <div className="card stack">
      <div className="row-between">
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>AI provider</div>
          <div className="faint">Optional — everything above works with zero providers configured.</div>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : configs.length > 0 ? "Manage" : "Add provider"}
        </button>
      </div>

      {activeConfig && !open && (
        <div className="row" style={{ fontSize: 13 }}>
          <span className="badge badge-good">connected</span> {activeConfig.providerId} · {activeConfig.defaultModel}
        </div>
      )}

      {open && (
        <div className="stack">
          {configs.length > 0 && (
            <div className="stack">
              {configs.map((c) => (
                <div key={c.providerId} className="row-between">
                  <label className="row">
                    <input type="radio" checked={activeConfig?.providerId === c.providerId} onChange={() => setActiveProviderId(c.providerId)} />
                    {c.providerId} · {c.defaultModel}
                  </label>
                  <button className="btn btn-sm btn-danger-ghost" onClick={() => void removeConfig(c.providerId)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="row" style={{ flexWrap: "wrap" }}>
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              {availableAdapters.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>
            {adapter?.requiresApiKey && (
              <input type="text" placeholder="API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            )}
            <input type="text" placeholder="Model (e.g. gpt-4o-mini)" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} />
            <button
              className="btn btn-primary"
              disabled={!providerId || !defaultModel || (adapter?.requiresApiKey && !apiKey)}
              onClick={() =>
                void saveConfig({ providerId, apiKey: apiKey || undefined, defaultModel }).then(() => {
                  setOpen(false);
                  setApiKey("");
                })
              }
            >
              Save
            </button>
          </div>
          <div className="faint">
            Stored locally in this browser. Encryption-at-rest for credentials (FR-PROV-3) isn't wired up yet — treat this as a dev-mode
            convenience, not production-ready credential storage.
          </div>
        </div>
      )}
    </div>
  );
}
