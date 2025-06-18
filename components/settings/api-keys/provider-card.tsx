"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Key, TestTube, Save, Trash2 } from "lucide-react";
import { PROVIDER_CONFIGS, type Provider } from "@/lib/crypto/api-key-manager";

interface ProviderCardProps {
  provider: Provider;
  hasKey: boolean;
  keyPrefix?: string;
  lastUsed?: number;
  onSave: (provider: Provider, apiKey: string) => Promise<void>;
  onDelete: (provider: Provider) => Promise<void>;
  onTest: (provider: Provider, apiKey: string) => Promise<boolean>;
}

export function ProviderCard({
  provider,
  hasKey,
  keyPrefix,
  lastUsed,
  onSave,
  onDelete,
  onTest,
}: ProviderCardProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const config = PROVIDER_CONFIGS[provider];

  const handleTest = async () => {
    if (!apiKey) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await onTest(provider, apiKey);
      setTestResult(result);
    } catch (error) {
      console.error("Test failed:", error);
      setTestResult(false);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey) return;

    setIsSaving(true);

    try {
      await onSave(provider, apiKey);
      setApiKey("");
      setTestResult(null);
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(provider);
      setApiKey("");
      setTestResult(null);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  return (
    <div className="bg-purple-50 dark:bg-dark-bg-secondary rounded-xl p-4 sm:p-6 space-y-3 sm:space-y-4">
      {/* Provider Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <img
          src={config.icon}
          alt={config.name}
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg sm:text-xl font-semibold text-purple-900 dark:text-purple-100">
            {config.name}
          </h3>
          <p className="text-purple-700 dark:text-purple-300 text-sm sm:text-base">
            {config.description}
          </p>
        </div>
        {hasKey && (
          <Badge
            variant="secondary"
            className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-xs sm:text-sm shrink-0"
          >
            <Key className="w-3 h-3 mr-1" />
            Configured
          </Badge>
        )}
      </div>

      {/* Existing Key Display */}
      {hasKey && keyPrefix && (
        <div className="bg-white dark:bg-dark-bg rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Label className="text-xs sm:text-sm font-medium text-purple-800 dark:text-purple-200 shrink-0">
                Current API Key:
              </Label>
              <code className="text-xs sm:text-sm font-mono text-purple-700 dark:text-purple-300 truncate bg-purple-50 dark:bg-dark-bg-tertiary px-2 py-1 rounded">
                {keyPrefix}
              </code>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 p-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {lastUsed && (
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
              Last used: {new Date(lastUsed).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* API Key Input */}
      <div className="space-y-2 sm:space-y-3">
        <Label
          htmlFor={`api-key-${provider}`}
          className="text-purple-800 dark:text-purple-200 font-medium text-sm sm:text-base"
        >
          {hasKey ? "Update API Key" : "Enter API Key"}
        </Label>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Input
              id={`api-key-${provider}`}
              type={showKey ? "text" : "password"}
              placeholder={config.keyFormat}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono bg-white dark:bg-dark-bg border-purple-200 dark:border-purple-700 focus:border-purple-500 dark:focus:border-purple-400 pr-10 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-dark-bg-tertiary"
            >
              {showKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!apiKey || isTesting}
              className="shrink-0 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-dark-bg-tertiary text-sm px-3 sm:px-4"
            >
              {isTesting ? (
                <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
              ) : (
                <TestTube className="w-4 h-4" />
              )}
              <span className="ml-1 sm:ml-2">Test</span>
            </Button>
            <Button
              onClick={handleSave}
              disabled={!apiKey || isSaving}
              className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 sm:px-4"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1 sm:mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Test Result */}
      {testResult !== null && (
        <div
          className={`text-xs sm:text-sm p-3 rounded-lg ${
            testResult
              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
          }`}
        >
          {testResult
            ? "✓ API key is valid and working"
            : "✗ API key test failed - please check your key"}
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400 leading-relaxed">
        Your API key is encrypted and stored securely. It&apos;s only used to
        make requests to {config.name} on your behalf.
      </p>
    </div>
  );
}
