import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ModelId } from "@/lib/ai-providers";
import { getAvailableModels, AI_MODELS } from "@/lib/ai-providers";

interface ModelStore {
  selectedModel: ModelId;
  setSelectedModel: (model: ModelId) => void;
  // Model visibility controls (synced with database)
  enabledModels: Set<ModelId>;
  setEnabledModels: (models: ModelId[]) => void;
  addEnabledModel: (modelId: ModelId) => void;
  removeEnabledModel: (modelId: ModelId) => void;
  getEnabledModels: () => ModelId[];
  // Validation helpers
  getVisionCapableModels: () => ModelId[];
  getGroqModels: () => ModelId[];
  canRemoveModel: (modelId: ModelId) => { canRemove: boolean; reason?: string };
  // User ID for syncing with database
  userId: string | null;
  setUserId: (userId: string | null) => void;
  // Database synchronization state
  isDbSynced: boolean;
  setDbSynced: (synced: boolean) => void;
  // Reset functions
  resetToDefault: () => void;
  resetEnabledModels: () => void;
  // Track hydration state
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  // Check if store is ready for use
  isReady: () => boolean;
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

// Helper function to check if a model has vision capabilities
const hasVisionCapabilities = (modelId: ModelId): boolean => {
  const config = AI_MODELS[modelId];
  return (
    config?.capabilities.vision || config?.capabilities.multimodal || false
  );
};

// Helper function to check if a model is a Groq model
const isGroqModel = (modelId: ModelId): boolean => {
  const config = AI_MODELS[modelId];
  return config?.provider === "groq";
};

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      selectedModel: DEFAULT_MODEL,
      enabledModels: getAllAvailableModels(),
      userId: null,
      isDbSynced: false,
      _hasHydrated: false,

      setSelectedModel: (model: ModelId) => {
        console.log("Zustand store - Setting model:", model);
        set({ selectedModel: model });
      },

      setEnabledModels: (models: ModelId[]) => {
        console.log("Zustand store - Setting enabled models:", models);
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

        // Check if removal is allowed
        const { canRemove } = get().canRemoveModel(modelId);
        if (!canRemove) {
          console.warn(
            `Cannot remove model ${modelId}: required for system functionality`,
          );
          return;
        }

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

      getVisionCapableModels: () => {
        const { enabledModels } = get();
        return Array.from(enabledModels).filter(hasVisionCapabilities);
      },

      getGroqModels: () => {
        const { enabledModels } = get();
        return Array.from(enabledModels).filter(isGroqModel);
      },

      canRemoveModel: (modelId: ModelId) => {
        const { enabledModels } = get();
        const currentEnabled = Array.from(enabledModels);

        // Don't allow removal if it's the only enabled model
        if (currentEnabled.length <= 1) {
          return {
            canRemove: false,
            reason: "At least one model must remain enabled",
          };
        }

        // Check if this is the last vision-capable model
        if (hasVisionCapabilities(modelId)) {
          const visionModels = currentEnabled.filter(hasVisionCapabilities);
          if (visionModels.length <= 1) {
            return {
              canRemove: false,
              reason:
                "At least one vision-capable model must remain enabled for image processing",
            };
          }
        }

        // Check if this is the last Groq model
        if (isGroqModel(modelId)) {
          const groqModels = currentEnabled.filter(isGroqModel);
          if (groqModels.length <= 1) {
            return {
              canRemove: false,
              reason:
                "At least one Groq model must remain enabled for fast responses",
            };
          }
        }

        return { canRemove: true };
      },

      setUserId: (userId: string | null) => {
        const currentUserId = get().userId;
        if (currentUserId !== userId) {
          console.log(
            "Zustand store - User changed, resetting DB sync state:",
            {
              oldUserId: currentUserId,
              newUserId: userId,
            },
          );
          // Reset sync state when user changes
          set({ userId, isDbSynced: false });
        }
      },

      setDbSynced: (synced: boolean) => {
        console.log("Zustand store - DB sync state changed:", synced);
        set({ isDbSynced: synced });
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

      isReady: () => {
        const { _hasHydrated, userId, isDbSynced } = get();
        // Store is ready when:
        // 1. It has hydrated from localStorage
        // 2. Either there's no user (anonymous) OR the database is synced
        return _hasHydrated && (!userId || isDbSynced);
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

/**
 * Convenience hook for components that need to wait for model store to be ready
 * This ensures proper cross-device synchronization
 */
export function useModelStoreReady() {
  const store = useModelStore();
  return {
    ...store,
    isReady: store.isReady(),
  };
}
