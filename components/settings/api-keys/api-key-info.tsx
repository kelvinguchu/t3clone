"use client";

import { Key } from "lucide-react";

export function ApiKeyInfo() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* How It Works Section */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 sm:p-6">
        <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 sm:mb-4 text-base sm:text-lg">
          How API Keys Work
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5 shrink-0">
                •
              </span>
              <span>
                API keys are stored securely and only used to make requests
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5 shrink-0">
                •
              </span>
              <span>
                You can test keys to ensure they&apos;re working correctly
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5 shrink-0">
                •
              </span>
              <span>Remove keys anytime to stop using your own credits</span>
            </li>
          </ul>
          <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5 shrink-0">
                •
              </span>
              <span>Use your own API quotas and rate limits</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5 shrink-0">
                •
              </span>
              <span>Access to your paid tier features and models</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 mt-0.5 shrink-0">
                •
              </span>
              <span>
                Fallback to system keys when yours aren&apos;t available
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 sm:p-6">
        <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 sm:mb-4 flex items-center gap-2 text-base sm:text-lg">
          <Key className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          Getting Your API Keys
        </h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h5 className="font-medium text-purple-800 dark:text-purple-200 text-sm sm:text-base">
                Groq
              </h5>
              <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 leading-relaxed">
                Visit{" "}
                <a
                  href="https://console.groq.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-purple-900 dark:hover:text-purple-100 break-all"
                >
                  console.groq.com
                </a>{" "}
                to create your free API key. Groq offers fast inference for
                Llama, DeepSeek, and Qwen models.
              </p>
            </div>
            <div className="space-y-2">
              <h5 className="font-medium text-purple-800 dark:text-purple-200 text-sm sm:text-base">
                Google AI
              </h5>
              <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 leading-relaxed">
                Get your API key from{" "}
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-purple-900 dark:hover:text-purple-100 break-all"
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
