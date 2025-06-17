import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ModelId } from "@/lib/ai-providers";

interface ModelStore {
  selectedModel: ModelId;
  setSelectedModel: (model: ModelId) => void;
  // Optional: Reset to default model
  resetToDefault: () => void;
  // Track hydration state
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

const DEFAULT_MODEL: ModelId = "gemini-2.0-flash";

export const useModelStore = create<ModelStore>()(
  persist(
    (set) => ({
      selectedModel: DEFAULT_MODEL,
      _hasHydrated: false,

      setSelectedModel: (model: ModelId) => {
        console.log("Zustand store - Setting model:", model);
        set({ selectedModel: model });
      },

      resetToDefault: () => {
        set({ selectedModel: DEFAULT_MODEL });
      },

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: "model-selection-store", // localStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist the selectedModel, not the functions or hydration state
      partialize: (state: ModelStore) => ({
        selectedModel: state.selectedModel,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
