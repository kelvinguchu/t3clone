"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SettingsPageWrapper } from "@/components/settings/shared/settings-page-wrapper";
import { useModelStore } from "@/lib/stores/model-store";
import { AI_MODELS, type ModelId } from "@/lib/ai-providers";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function ModelsPage() {
  const { user } = useUser();
  const {
    enabledModels,
    setEnabledModels,
    addEnabledModel,
    removeEnabledModel,
    canRemoveModel,
    getVisionCapableModels,
    getGroqModels,
    setUserId,
    setDbSynced,
    isReady,
    _hasHydrated,
  } = useModelStore();

  const [mounted, setMounted] = useState(false);

  // Convex queries and mutations
  const userEnabledModels = useQuery(
    api.userPreferences.getEnabledModels,
    user ? { userId: user.id } : "skip",
  );

  const setEnabledModelsMutation = useMutation(
    api.userPreferences.setEnabledModels,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Set user ID in store when user changes
  useEffect(() => {
    if (user) {
      setUserId(user.id);
    } else {
      setUserId(null);
    }
  }, [user, setUserId]);

  // Initialize enabled models from database and mark as synced
  useEffect(() => {
    if (!mounted || !_hasHydrated || !user) return;

    if (userEnabledModels !== undefined) {
      if (userEnabledModels === null) {
        // No preferences in database, keep current defaults
        console.log("No user preferences found, using default enabled models");
        setDbSynced(true); // Mark as synced since we've confirmed no DB preferences exist
      } else {
        // Load preferences from database
        console.log("Loading enabled models from database:", userEnabledModels);
        setEnabledModels(userEnabledModels as ModelId[]);
        setDbSynced(true); // Mark as synced after loading from DB
      }
    }
  }, [
    mounted,
    _hasHydrated,
    user,
    userEnabledModels,
    setEnabledModels,
    setDbSynced,
  ]);

  const handleModelToggle = async (modelId: ModelId, enabled: boolean) => {
    if (!user) return;

    try {
      if (enabled) {
        addEnabledModel(modelId);
      } else {
        // Check if model can be removed
        const { canRemove, reason } = canRemoveModel(modelId);
        if (!canRemove) {
          console.warn(`Cannot disable ${modelId}: ${reason}`);
          // You could add a toast notification here to inform the user
          return;
        }
        removeEnabledModel(modelId);
      }

      // Sync to database
      const currentEnabled = Array.from(enabledModels);
      const newEnabled = enabled
        ? [...currentEnabled, modelId].filter(
            (id, index, arr) => arr.indexOf(id) === index,
          )
        : currentEnabled.filter((id) => id !== modelId);

      await setEnabledModelsMutation({
        userId: user.id,
        enabledModels: newEnabled,
      });
    } catch (error) {
      console.error("Failed to update model preferences:", error);
    }
  };

  // Don't render until the store is fully ready (hydrated and synced)
  if (!mounted || !user || !isReady()) {
    return (
      <SettingsPageWrapper
        title="Models"
        description="Configure which AI models are available in chat"
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        </div>
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper
      title="Models"
      description="Configure which AI models are available in chat"
    >
      <div className="space-y-4">
        {/* Requirements Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Model Requirements
              </h4>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <p>
                  • At least one <strong>vision-capable model</strong> (Gemini)
                  must be enabled for image processing
                </p>
                <p>
                  • At least one <strong>Groq model</strong> (Llama, DeepSeek,
                  Qwen) must be enabled for fast responses
                </p>
                <p>
                  • Currently enabled:{" "}
                  <strong>{getVisionCapableModels().length} vision</strong>,{" "}
                  <strong>{getGroqModels().length} Groq</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        {Object.entries(AI_MODELS).map(([modelId, config]) => {
          const isEnabled = enabledModels.has(modelId as ModelId);
          const { canRemove, reason } = canRemoveModel(modelId as ModelId);

          // Get enabled capabilities
          const enabledCapabilities = Object.entries(config.capabilities)
            .filter(([, enabled]) => enabled)
            .map(([capability]) => capability);

          return (
            <div
              key={modelId}
              className={`transition-all duration-200 p-4 sm:p-6 border rounded-lg ${
                isEnabled
                  ? "bg-white dark:bg-dark-bg-secondary border-purple-200/60 dark:border-purple-800/50"
                  : "bg-gray-50 dark:bg-gray-900/50 border-gray-200/60 dark:border-gray-800/50 opacity-60"
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Model Icon */}
                <div className="shrink-0">
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center ${
                      isEnabled
                        ? "bg-purple-100 dark:bg-purple-900/30"
                        : "bg-gray-100 dark:bg-gray-800/30"
                    }`}
                  >
                    <img
                      src={config.icon}
                      alt={config.displayName}
                      className="w-6 h-6 sm:w-8 sm:h-8"
                    />
                  </div>
                </div>

                {/* Model Info */}
                <div className="flex-1 min-w-0">
                  <div className="space-y-3">
                    {/* Model Name */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3
                            className={`font-semibold text-sm sm:text-base break-words ${
                              isEnabled
                                ? "text-purple-900 dark:text-purple-100"
                                : "text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {config.displayName}
                          </h3>
                          {/* Special badges for required model types */}
                          {(config.capabilities.vision ||
                            config.capabilities.multimodal) && (
                            <Badge
                              variant="secondary"
                              className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200"
                            >
                              Vision
                            </Badge>
                          )}
                          {config.provider === "groq" && (
                            <Badge
                              variant="secondary"
                              className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200"
                            >
                              Fast
                            </Badge>
                          )}
                        </div>
                        <p
                          className={`text-xs sm:text-sm ${
                            isEnabled
                              ? "text-purple-600 dark:text-purple-400"
                              : "text-gray-500 dark:text-gray-500"
                          }`}
                        >
                          {config.description}
                        </p>
                        {/* Show restriction reason if can't remove */}
                        {isEnabled && !canRemove && reason && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                            Required: {reason}
                          </p>
                        )}
                      </div>

                      {/* Toggle Switch */}
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(enabled) =>
                          handleModelToggle(modelId as ModelId, enabled)
                        }
                        disabled={isEnabled && !canRemove}
                        className="cursor-pointer"
                      />
                    </div>

                    {/* Capabilities */}
                    <div className="flex flex-wrap gap-1.5">
                      {enabledCapabilities.map((capability) => (
                        <Badge
                          key={capability}
                          variant="secondary"
                          className={`text-xs px-2 py-0.5 ${
                            isEnabled
                              ? "bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {capability
                            .replace(/([A-Z])/g, " $1")
                            .toLowerCase()
                            .trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SettingsPageWrapper>
  );
}
