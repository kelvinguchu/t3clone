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
    <div className="bg-purple-50 dark:bg-dark-bg-secondary rounded-xl p-6 space-y-4">
      {/* Provider Header */}
      <div className="flex items-center gap-4">
        <img
          src={config.icon}
          alt={config.name}
          className="w-10 h-10 rounded-lg"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold text-purple-900 dark:text-purple-100">
            {config.name}
          </h3>
          <p className="text-purple-700 dark:text-purple-300">
            {config.description}
          </p>
        </div>
        {hasKey && (
          <Badge
            variant="secondary"
            className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200"
          >
            <Key className="w-3 h-3 mr-1" />
            Configured
          </Badge>
        )}
      </div>

      {/* Existing Key Display */}
      {hasKey && keyPrefix && (
        <div className="bg-white dark:bg-dark-bg rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Label className="text-sm font-medium text-purple-800 dark:text-purple-200 shrink-0">
                Current API Key:
              </Label>
              <code className="text-sm font-mono text-purple-700 dark:text-purple-300 truncate bg-purple-50 dark:bg-dark-bg-tertiary px-2 py-1 rounded">
                {keyPrefix}
              </code>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
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
      <div className="space-y-3">
        <Label
          htmlFor={`api-key-${provider}`}
          className="text-purple-800 dark:text-purple-200 font-medium"
        >
          {hasKey ? "Update API Key" : "Enter API Key"}
        </Label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Input
              id={`api-key-${provider}`}
              type={showKey ? "text" : "password"}
              placeholder={config.keyFormat}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono bg-white dark:bg-dark-bg border-purple-200 dark:border-purple-700 focus:border-purple-500 dark:focus:border-purple-400 pr-10"
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
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!apiKey || isTesting}
            className="shrink-0 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-dark-bg-tertiary"
          >
            {isTesting ? (
              <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
            ) : (
              <TestTube className="w-4 h-4" />
            )}
            Test
          </Button>
          <Button
            onClick={handleSave}
            disabled={!apiKey || isSaving}
            className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Test Result */}
      {testResult !== null && (
        <div
          className={`text-sm p-3 rounded-lg ${
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
      <p className="text-sm text-purple-600 dark:text-purple-400">
        Your API key is encrypted and stored securely. It&apos;s only used to
        make requests to {config.name} on your behalf.
      </p>
    </div>
  );
}
