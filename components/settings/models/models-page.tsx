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
    setUserId,
    _hasHydrated,
  } = useModelStore();

  const [mounted, setMounted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

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

  // Initialize enabled models from database or use defaults
  useEffect(() => {
    if (!mounted || !_hasHydrated || !user) return;

    if (userEnabledModels !== undefined && !isInitialized) {
      if (userEnabledModels === null) {
        // No preferences in database, keep current defaults
        console.log("No user preferences found, using default enabled models");
      } else {
        // Load preferences from database
        console.log("Loading enabled models from database:", userEnabledModels);
        setEnabledModels(userEnabledModels as ModelId[]);
      }
      setIsInitialized(true);
    }
  }, [
    mounted,
    _hasHydrated,
    user,
    userEnabledModels,
    isInitialized,
    setEnabledModels,
  ]);

  const handleModelToggle = async (modelId: ModelId, enabled: boolean) => {
    if (!user) return;

    try {
      if (enabled) {
        addEnabledModel(modelId);
      } else {
        removeEnabledModel(modelId);
      }

      // Sync to database
      const currentEnabled = Array.from(enabledModels);
      const newEnabled = enabled
        ? [...currentEnabled, modelId].filter(
            (id, index, arr) => arr.indexOf(id) === index,
          )
        : currentEnabled.filter((id) => id !== modelId);

      // Ensure at least one model remains enabled
      if (newEnabled.length === 0) {
        return;
      }

      await setEnabledModelsMutation({
        userId: user.id,
        enabledModels: newEnabled,
      });
    } catch (error) {
      console.error("Failed to update model preferences:", error);
    }
  };

  // Don't render until hydrated and initialized to avoid SSR mismatch
  if (!mounted || !_hasHydrated || !user || !isInitialized) {
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
        {Object.entries(AI_MODELS).map(([modelId, config]) => {
          const isEnabled = enabledModels.has(modelId as ModelId);

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
                        <h3
                          className={`font-semibold text-sm sm:text-base break-words ${
                            isEnabled
                              ? "text-purple-900 dark:text-purple-100"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {config.displayName}
                        </h3>
                        <p
                          className={`text-xs sm:text-sm mt-1 ${
                            isEnabled
                              ? "text-purple-600 dark:text-purple-400"
                              : "text-gray-500 dark:text-gray-500"
                          }`}
                        >
                          {config.description}
                        </p>
                      </div>

                      {/* Toggle Switch */}
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(enabled) =>
                          handleModelToggle(modelId as ModelId, enabled)
                        }
                        disabled={!isEnabled && enabledModels.size === 1}
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
