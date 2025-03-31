import { useMemo, useState, useEffect } from "react";
import { useAccessStore, useAppConfig } from "../store";
import { collectModelsWithDefaultModel } from "./model";
import { safeLocalStorage } from "../utils";
import { StoreKey } from "../constant";
import { Model, userCustomProvider } from "../client/api";

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
  const [customProviderModels, setCustomProviderModels] = useState<Model[]>(
    () => {
      const storedProviders = safeLocalStorage().getItem(
        StoreKey.CustomProvider,
      );
      if (!storedProviders) return [];
      try {
        const providers = JSON.parse(storedProviders) as userCustomProvider[];
        const activeProviders = providers.filter((p) => p.status === "active");
        return activeProviders.flatMap((provider) => {
          return (provider.models || [])
            .filter((model) => model.available)
            .map((model) => ({
              name: model.name,
              available: true,
              displayName: `${model.name} | ${provider.name}`,
              provider: {
                id: model.name,
                providerName: provider.name,
                providerType: "custom-provider",
                // baseUrl: provider.baseUrl,
                // apiKey: provider.apiKey,
              },
              isCustom: true as const,
            }));
        });
      } catch (e) {
        console.error("Failed to parse custom providers:", e);
        return [];
      }
    },
  );
  // }, []);
  // Combine built-in models with custom provider models
  return useMemo(() => {
    return [...customProviderModels, ...builtInModels];
  }, [builtInModels, customProviderModels]);
}
