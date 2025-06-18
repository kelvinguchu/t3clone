"use client";

import { Key } from "lucide-react";

export function ApiKeyInfo() {
  return (
    <div className="space-y-6">
      {/* How It Works Section */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
        <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-4">
          How API Keys Work
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5">
                •
              </span>
              API keys are stored securely and only used to make requests
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5">
                •
              </span>
              You can test keys to ensure they&apos;re working correctly
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5">
                •
              </span>
              Remove keys anytime to stop using your own credits
            </li>
          </ul>
          <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5">
                •
              </span>
              Use your own API quotas and rate limits
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5">
                •
              </span>
              Access to your paid tier features and models
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5">
                •
              </span>
              Fallback to system keys when yours aren&apos;t available
            </li>
          </ul>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
        <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5" />
          Getting Your API Keys
        </h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h5 className="font-medium text-purple-800 dark:text-purple-200">
                Groq
              </h5>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Visit{" "}
                <a
                  href="https://console.groq.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-purple-900 dark:hover:text-purple-100"
                >
                  console.groq.com
                </a>{" "}
                to create your free API key. Groq offers fast inference for
                Llama, DeepSeek, and Qwen models.
              </p>
            </div>
            <div className="space-y-2">
              <h5 className="font-medium text-purple-800 dark:text-purple-200">
                Google AI
              </h5>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Get your API key from{" "}
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-purple-900 dark:hover:text-purple-100"
                >
                  aistudio.google.com
                </a>
                . Access Gemini models with multimodal capabilities.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
