"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Paperclip,
  Globe,
  Send,
  Square,
  Eye,
  Brain,
  Wrench,
  Layers,
  Zap,
  FileText,
} from "lucide-react";
import { HiPhoto } from "react-icons/hi2";
import {
  getAvailableModels,
  getModelInfo,
  type ModelId,
} from "@/lib/ai-providers";

export interface InputControlsProps {
  // Model selection
  selectedModel: ModelId;
  setSelectedModel: (model: ModelId) => void;
  _hasHydrated: boolean;

  // Button states
  canSend: boolean;
  canStop: boolean;
  isDisabled: boolean;
  isSavingPartial: boolean;

  // Web browsing
  enableWebBrowsing: boolean;
  setEnableWebBrowsing: (enabled: boolean) => void;

  // Action handlers
  triggerFileSelect: (accept: string) => void;
  handleSendOrStop: () => void;
  getButtonTitle: (
    canSend: boolean,
    canStop: boolean,
    isSavingPartial: boolean,
  ) => string;
}

/**
 * Input controls component extracted from original chat-input.tsx lines 766-922
 * Contains model selector, action buttons, and send/stop button
 */
export function InputControls({
  selectedModel,
  setSelectedModel,
  _hasHydrated,
  canSend,
  canStop,
  isDisabled,
  isSavingPartial,
  enableWebBrowsing,
  setEnableWebBrowsing,
  triggerFileSelect,
  handleSendOrStop,
  getButtonTitle,
}: Readonly<InputControlsProps>) {
  const availableModels = getAvailableModels();
  const currentModelInfo = getModelInfo(selectedModel);

  return (
    /* Bottom Row: Model Selector and Action Buttons - extracted from lines 766-922 */
    <div className="flex items-center justify-between gap-2 mt-2 px-1">
      {/* Model selector and action buttons */}
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto flex-1 min-w-0">
        <Select
          value={_hasHydrated ? selectedModel : "gemini-2.0-flash"}
          onValueChange={(newModel) => {
            setSelectedModel(newModel as ModelId);
          }}
          disabled={isDisabled}
        >
          <SelectTrigger className="group w-auto min-w-20 sm:min-w-32 md:min-w-40 border-2 border-purple-300 dark:border-dark-purple-accent bg-white dark:bg-dark-bg-tertiary backdrop-blur-md text-xs text-purple-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-dark-bg-secondary hover:border-purple-400 dark:hover:border-dark-purple-glow rounded-lg h-8 sm:h-9 shadow-lg shadow-purple-500/10 transition-all duration-300 hover:shadow-purple-500/20 dark:hover:shadow-dark-purple-glow/20 hover:scale-[1.02] flex-shrink-0">
            <div className="flex items-center gap-1">
              <div className="relative">
                <img
                  src={currentModelInfo.icon}
                  alt={currentModelInfo.name}
                  className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <span className="font-semibold tracking-wide truncate text-xs sm:text-xs">
                {currentModelInfo.name}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent className="border-2 border-purple-300 dark:border-dark-purple-accent bg-white dark:bg-dark-bg-tertiary backdrop-blur-xl shadow-2xl shadow-purple-500/25 dark:shadow-dark-purple-glow/25 rounded-xl p-1 w-full max-w-xs">
            {availableModels.map((modelId) => {
              const modelInfo = getModelInfo(modelId);
              return (
                <SelectItem
                  key={modelId}
                  value={modelId}
                  className={`rounded-lg hover:bg-purple-50 dark:hover:bg-dark-bg-secondary transition-all duration-200 hover:scale-[1.02] focus:bg-gradient-to-r ${
                    modelInfo.theme === "blue"
                      ? "focus:from-blue-500/10 focus:to-blue-600/10"
                      : modelInfo.theme === "green"
                        ? "focus:from-green-500/10 focus:to-green-600/10"
                        : "focus:from-orange-500/10 focus:to-orange-600/10"
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 py-1">
                    <div className="relative">
                      <img
                        src={modelInfo.icon}
                        alt={modelInfo.name}
                        className="h-4 w-4 sm:h-5 sm:w-5"
                      />
                      <div
                        className={`absolute -inset-1 rounded-full blur-sm opacity-60 ${
                          modelInfo.theme === "blue"
                            ? "bg-blue-400/20"
                            : modelInfo.theme === "green"
                              ? "bg-green-400/20"
                              : "bg-orange-400/20"
                        }`}
                      ></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-xs sm:text-sm">
                        {modelInfo.name}
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        {modelInfo.capabilities.vision && (
                          <Eye className="h-3 w-3 text-blue-500" />
                        )}
                        {modelInfo.capabilities.thinking && (
                          <Brain className="h-3 w-3 text-amber-500" />
                        )}
                        {modelInfo.capabilities.tools && (
                          <Wrench className="h-3 w-3 text-green-500" />
                        )}
                        {modelInfo.capabilities.imageGeneration && (
                          <HiPhoto className="h-3 w-3 text-purple-500" />
                        )}
                        {modelInfo.capabilities.multimodal && (
                          <Layers className="h-3 w-3 text-indigo-500" />
                        )}
                        {modelInfo.capabilities.fastResponse && (
                          <Zap className="h-3 w-3 text-yellow-500" />
                        )}
                        {modelInfo.capabilities.longContext && (
                          <FileText className="h-3 w-3 text-cyan-500" />
                        )}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Action Buttons - dynamically shown based on model capabilities */}

        {/* Image Upload Button - Only show for vision/multimodal models */}
        {(currentModelInfo.capabilities.vision ||
          currentModelInfo.capabilities.multimodal) && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg flex-shrink-0"
            title="Upload images - Vision enabled"
            disabled={isDisabled}
            onClick={() => triggerFileSelect("image/*")}
          >
            <HiPhoto className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        )}

        {/* PDF/Document Upload Button - Always available */}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer text-purple-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-slate-300 hover:bg-purple-100 dark:hover:bg-dark-bg-secondary rounded-lg flex-shrink-0"
          title="Upload documents (PDFs, text files)"
          disabled={isDisabled}
          onClick={() => triggerFileSelect("application/pdf,text/*")}
        >
          <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>

        {/* Web Browsing Button - Only show if model supports tools */}
        {currentModelInfo.capabilities.tools && (
          <Button
            size="icon"
            variant="ghost"
            className={`h-8 w-8 sm:h-9 sm:w-9 cursor-pointer rounded-lg transition-all duration-200 flex-shrink-0 ${
              enableWebBrowsing
                ? "text-emerald-600 hover:text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/40"
                : "text-gray-600 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-dark-bg-secondary"
            }`}
            title={
              enableWebBrowsing
                ? "Web browsing enabled - AI will browse the web for information"
                : "Enable web browsing - AI will search and browse websites when needed"
            }
            disabled={isDisabled}
            onClick={() => {
              const newState = !enableWebBrowsing;
              setEnableWebBrowsing(newState);
            }}
          >
            <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        )}
      </div>

      {/* Send/Stop Button - extracted from lines 878-922 */}
      <Button
        size="icon"
        variant={canSend || canStop ? "default" : "ghost"}
        className={`h-8 w-8 sm:h-9 sm:w-9 cursor-pointer shrink-0 transition-all duration-200 ml-2 ${
          canSend || canStop
            ? "bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl hover:scale-105"
            : "text-purple-400 dark:text-purple-500 cursor-not-allowed"
        } ${isSavingPartial ? "animate-pulse bg-orange-500 hover:bg-orange-600" : ""}`}
        onClick={handleSendOrStop}
        disabled={(!canSend && !canStop) || isSavingPartial}
        title={getButtonTitle(canSend, canStop, isSavingPartial)}
      >
        {isSavingPartial ? (
          <div className="h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : canStop ? (
          <Square className="h-4 w-4 sm:h-5 sm:w-5" />
        ) : (
          <Send className="h-4 w-4 sm:h-5 sm:w-5" />
        )}
      </Button>
    </div>
  );
}

/**
 * Utility function to get model theme focus classes
 */
export function getModelThemeFocusClasses(theme: string): string {
  switch (theme) {
    case "blue":
      return "focus:from-blue-500/10 focus:to-blue-600/10";
    case "green":
      return "focus:from-green-500/10 focus:to-green-600/10";
    case "orange":
      return "focus:from-orange-500/10 focus:to-orange-600/10";
    default:
      return "focus:from-orange-500/10 focus:to-orange-600/10";
  }
}

/**
 * Utility function to get model theme background classes
 */
export function getModelThemeBackgroundClasses(theme: string): string {
  switch (theme) {
    case "blue":
      return "bg-blue-400/20";
    case "green":
      return "bg-green-400/20";
    case "orange":
      return "bg-orange-400/20";
    default:
      return "bg-orange-400/20";
  }
}
