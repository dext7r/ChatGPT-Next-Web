import { useMemo, useState, useEffect } from "react";
import { useAccessStore, useAppConfig } from "../store";
import { collectModelsWithDefaultModel } from "./model";
import { safeLocalStorage } from "../utils";
import { StoreKey } from "../constant";
import { userCustomModel, userCustomProvider } from "../client/api";

export function useAllModels() {
  const accessStore = useAccessStore();
  const configStore = useAppConfig();
  const models = useMemo(() => {
    return collectModelsWithDefaultModel(
      configStore.models,
      [configStore.customModels, accessStore.customModels].join(","),
      accessStore.defaultModel,
    );
  }, [
    accessStore.customModels,
    accessStore.defaultModel,
    configStore.customModels,
    configStore.models,
  ]);

  return models;
}

// New hook that combines built-in models with custom provider models
export function useAllModelsWithCustomProviders() {
  const builtInModels = useAllModels();
  const [customProviderModels, setCustomProviderModels] = useState<
    userCustomModel[]
  >([]);

  // Load custom provider models from localStorage
  useEffect(() => {
    const storedProviders = safeLocalStorage().getItem(StoreKey.CustomProvider);
    if (storedProviders) {
      try {
        const providers = JSON.parse(storedProviders) as userCustomProvider[];
        // Only process active providers
        const activeProviders = providers.filter((p) => p.status === "active");
        // Extract selected models from each provider
        const models = activeProviders.flatMap((provider) => {
          return (provider.models || [])
            .filter((model) => model.selected)
            .map((model) => ({
              name: model.name,
              available: true,
              displayName: `${model.name}`,
              provider: {
                providerName: provider.name,
                baseUrl: provider.baseUrl,
                apiKey: provider.apiKey,
                type: provider.type,
                id: model.name,
              },
              isCustom: true as const,
            }));
        });

        setCustomProviderModels(models);
      } catch (e) {
        console.error("Failed to parse custom providers:", e);
        setCustomProviderModels([]);
      }
    }
  }, []);
  // Combine built-in models with custom provider models
  return useMemo(() => {
    return [...customProviderModels, ...builtInModels];
  }, [builtInModels, customProviderModels]);
}
