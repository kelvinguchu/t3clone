"use client";

import { Button } from "@/components/ui/button";
import { ProviderCard } from "./provider-card";
import { ApiKeyInfo } from "./api-key-info";
import {
  type Provider,
  encryptUserApiKey,
  testApiKey,
  getKeyPrefix,
} from "@/lib/crypto/api-key-manager";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";

// Providers that support bring-your-own-key (BYOK)
const SUPPORTED_PROVIDERS: Provider[] = ["groq", "google"];

export function ApiKeysPage() {
  const { user } = useUser();

  // Database operations for API key management
  const storeApiKey = useMutation(api.apiKeys.storeApiKey);
  const deleteApiKey = useMutation(api.apiKeys.deleteApiKey);
  const userApiKeys = useQuery(api.apiKeys.getUserApiKeys);
  const providerStats = useQuery(api.apiKeys.getProviderStats);

  const handleSaveKey = async (provider: Provider, apiKey: string) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      // Encrypt API key with user-specific salt and store securely
      const encryptedData = await encryptUserApiKey(apiKey, user.id);

      await storeApiKey({
        provider,
        encryptedData: encryptedData.encryptedData,
        iv: encryptedData.iv,
        salt: encryptedData.salt,
        algorithm: encryptedData.algorithm,
        iterations: encryptedData.iterations,
        keyPrefix: getKeyPrefix(apiKey),
      });
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteKey = async (provider: Provider) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      // Find and delete user's API key for provider
      const userKey = userApiKeys?.find((key) => key.provider === provider);
      if (userKey) {
        await deleteApiKey({ keyId: userKey._id });
      }
    } catch (error) {
      throw error;
    }
  };

  const handleTestKey = async (
    provider: Provider,
    apiKey: string,
  ): Promise<boolean> => {
    try {
      // Validate API key by testing with provider's API
      const isValid = await testApiKey(provider, apiKey);
      return isValid;
    } catch {
      return false;
    }
  };

  // Extract user's API key metadata for display
  const getUserKeyData = (provider: Provider) => {
    const stats = providerStats?.find((stat) => stat.provider === provider);
    const keyMeta = userApiKeys?.find((key) => key.provider === provider);

    return {
      hasKey: stats?.hasKey || false,
      keyPrefix: keyMeta?.keyPrefix,
      lastUsed: stats?.lastUsed || keyMeta?.lastUsed,
    };
  };

  return (
    <div className="h-full w-full space-y-4 sm:space-y-6 px-0 sm:px-4">
      {/* Pro Feature Notice */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 sm:p-6 text-center border border-purple-200/60 dark:border-purple-800/50 shadow-sm">
        <div className="space-y-3 sm:space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-purple-900 dark:text-purple-100">
              Pro Feature
            </h3>
            <p className="text-purple-700 dark:text-purple-300 mt-2 text-sm sm:text-base">
              Upgrade to Pro to access this feature.
            </p>
          </div>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white text-sm sm:text-base px-4 sm:px-6 py-2 shadow-lg">
            Upgrade to Pro - $8/month
          </Button>
        </div>
      </div>

      {/* API Providers List */}
      <div className="space-y-3 sm:space-y-4">
        {SUPPORTED_PROVIDERS.map((provider) => {
          const keyData = getUserKeyData(provider);

          return (
            <ProviderCard
              key={provider}
              provider={provider}
              hasKey={keyData.hasKey}
              keyPrefix={keyData.keyPrefix}
              lastUsed={keyData.lastUsed}
              onSave={handleSaveKey}
              onDelete={handleDeleteKey}
              onTest={handleTestKey}
            />
          );
        })}
      </div>

      {/* Additional Information */}
      <ApiKeyInfo />
    </div>
  );
}
