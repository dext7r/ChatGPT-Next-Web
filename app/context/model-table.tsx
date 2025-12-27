"use client";

import { createContext, useContext, useMemo, ReactNode } from "react";
import { Model } from "../client/api";
import { useAllModelsWithCustomProviders } from "../utils/hooks";

type ModelTableContextType = Model[];

const ModelTableContext = createContext<ModelTableContextType | null>(null);

export function ModelTableProvider({ children }: { children: ReactNode }) {
  const allModels = useAllModelsWithCustomProviders();

  const modelTable = useMemo(() => {
    const filteredModels = allModels.filter((m) => m.available);
    const modelMap = new Map<string, (typeof allModels)[0]>();

    filteredModels.forEach((model) => {
      const key = `${model.name}@${model?.provider?.id}`;

      if (modelMap.has(key)) {
        const existingModel = modelMap.get(key)!;
        if (model.description && !existingModel.description) {
          existingModel.description = model.description;
        }
        if (model.displayName && !existingModel.displayName) {
          existingModel.displayName = model.displayName;
        }
        if (model.isDefault) {
          existingModel.isDefault = true;
        }
      } else {
        modelMap.set(key, { ...model });
      }
    });

    const mergedModels = Array.from(modelMap.values());
    const defaultModel = mergedModels.find((m) => m.isDefault);

    if (defaultModel) {
      return [defaultModel, ...mergedModels.filter((m) => m !== defaultModel)];
    }

    return mergedModels;
  }, [allModels]);

  return (
    <ModelTableContext.Provider value={modelTable}>
      {children}
    </ModelTableContext.Provider>
  );
}

export function useModelTable(): Model[] {
  const context = useContext(ModelTableContext);
  if (context === null) {
    throw new Error("useModelTable must be used within a ModelTableProvider");
  }
  return context;
}
