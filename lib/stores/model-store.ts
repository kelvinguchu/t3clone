import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModelId } from "@/lib/ai-providers";

interface ModelStore {
  selectedModel: ModelId;
  setSelectedModel: (model: ModelId) => void;
  // Optional: Reset to default model
  resetToDefault: () => void;
}

const DEFAULT_MODEL: ModelId = "gemini-2.0-flash";

export const useModelStore = create<ModelStore>()(
  persist(
    (set) => ({
      selectedModel: DEFAULT_MODEL,

      setSelectedModel: (model: ModelId) => {
        set({ selectedModel: model });
      },

      resetToDefault: () => {
        set({ selectedModel: DEFAULT_MODEL });
      },
    }),
    {
      name: "model-selection-store", // localStorage key
      // Only persist the selectedModel, not the functions
      partialize: (state: ModelStore) => ({
        selectedModel: state.selectedModel,
      }),
    },
  ),
);
