import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ModelId } from "@/lib/ai-providers";
import { getAvailableModels } from "@/lib/ai-providers";

interface ModelStore {
  selectedModel: ModelId;
  setSelectedModel: (model: ModelId) => void;
  // Model visibility controls (synced with database)
  enabledModels: Set<ModelId>;
  setEnabledModels: (models: ModelId[]) => void;
  addEnabledModel: (modelId: ModelId) => void;
  removeEnabledModel: (modelId: ModelId) => void;
  getEnabledModels: () => ModelId[];
  // User ID for syncing with database
  userId: string | null;
  setUserId: (userId: string | null) => void;
  // Reset functions
  resetToDefault: () => void;
  resetEnabledModels: () => void;
  // Track hydration state
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

const DEFAULT_MODEL: ModelId = "gemini-2.0-flash";

// Get all available models and enable them by default
const getAllAvailableModels = (): Set<ModelId> => {
  try {
    const models = getAvailableModels();
    return new Set(models);
  } catch {
    // Fallback if getAvailableModels fails
    return new Set([DEFAULT_MODEL]);
  }
};

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      selectedModel: DEFAULT_MODEL,
      enabledModels: getAllAvailableModels(),
      userId: null,
      _hasHydrated: false,

      setSelectedModel: (model: ModelId) => {
        console.log("Zustand store - Setting model:", model);
        set({ selectedModel: model });
      },

      setEnabledModels: (models: ModelId[]) => {
        const newEnabledModels = new Set(models);
        const { selectedModel } = get();

        // If currently selected model is being disabled, switch to first enabled model
        if (!newEnabledModels.has(selectedModel) && models.length > 0) {
          set({
            enabledModels: newEnabledModels,
            selectedModel: models[0],
          });
        } else {
          set({ enabledModels: newEnabledModels });
        }
      },

      addEnabledModel: (modelId: ModelId) => {
        const { enabledModels } = get();
        const newEnabledModels = new Set(enabledModels);
        newEnabledModels.add(modelId);
        set({ enabledModels: newEnabledModels });
      },

      removeEnabledModel: (modelId: ModelId) => {
        const { enabledModels, selectedModel } = get();
        const newEnabledModels = new Set(enabledModels);

        // Don't remove if it's the only enabled model
        if (newEnabledModels.size <= 1) return;

        newEnabledModels.delete(modelId);

        // If we're removing the currently selected model, switch to first enabled model
        if (selectedModel === modelId) {
          const remainingModels = Array.from(newEnabledModels);
          if (remainingModels.length > 0) {
            set({
              enabledModels: newEnabledModels,
              selectedModel: remainingModels[0],
            });
            return;
          }
        }

        set({ enabledModels: newEnabledModels });
      },

      getEnabledModels: () => {
        return Array.from(get().enabledModels);
      },

      setUserId: (userId: string | null) => {
        set({ userId });
      },

      resetToDefault: () => {
        set({ selectedModel: DEFAULT_MODEL });
      },

      resetEnabledModels: () => {
        set({ enabledModels: getAllAvailableModels() });
      },

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: "model-selection-store", // localStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist the selectedModel, not enabledModels (those come from database)
      partialize: (state: ModelStore) => ({
        selectedModel: state.selectedModel,
        userId: state.userId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
