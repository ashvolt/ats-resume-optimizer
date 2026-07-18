import { useCallback, useEffect, useState } from "react";
import type { ProviderConfig } from "../core/providers/types";
import { getProviderAdapter, listProviderAdapters } from "../core/providers/registry";
import { storage } from "./storage";

export interface UseProviderConfig {
  configs: ProviderConfig[];
  activeConfig: ProviderConfig | null;
  setActiveProviderId: (providerId: string | null) => void;
  saveConfig: (config: ProviderConfig) => Promise<void>;
  removeConfig: (providerId: string) => Promise<void>;
  availableAdapters: ReturnType<typeof listProviderAdapters>;
  activeAdapter: ReturnType<typeof getProviderAdapter>;
}

/**
 * FR-PROV-2: the app must work fully with zero providers configured, so this hook's `activeConfig`
 * is allowed to be null everywhere it's consumed.
 *
 * Known gap: FR-PROV-3 calls for credentials encrypted at rest (architecture.md §11, PBKDF2/WebCrypto
 * against a user passphrase). This wiring pass stores `ProviderConfig` — including `apiKey` — as
 * plaintext in IndexedDB via the existing `StorageAdapter`. That's a real, tracked gap, not an
 * oversight: encryption is its own scoped unit of work (a passphrase-setup UX, key derivation,
 * migration of already-stored configs) that deserves its own pass rather than being bolted on here.
 */
export function useProviderConfig(): UseProviderConfig {
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);

  useEffect(() => {
    void storage.getAll("providerConfigs").then((all) => {
      setConfigs(all);
      if (all.length > 0 && all[0]) setActiveProviderId(all[0].providerId);
    });
  }, []);

  const saveConfig = useCallback(async (config: ProviderConfig) => {
    await storage.put("providerConfigs", config);
    setConfigs((prev) => [...prev.filter((c) => c.providerId !== config.providerId), config]);
    setActiveProviderId(config.providerId);
  }, []);

  const removeConfig = useCallback(async (providerId: string) => {
    await storage.delete("providerConfigs", providerId);
    setConfigs((prev) => prev.filter((c) => c.providerId !== providerId));
    setActiveProviderId((current) => (current === providerId ? null : current));
  }, []);

  const activeConfig = configs.find((c) => c.providerId === activeProviderId) ?? null;

  return {
    configs,
    activeConfig,
    setActiveProviderId,
    saveConfig,
    removeConfig,
    availableAdapters: listProviderAdapters(),
    activeAdapter: activeConfig ? getProviderAdapter(activeConfig.providerId) : undefined,
  };
}
