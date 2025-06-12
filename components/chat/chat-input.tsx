"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "motion/react";
import { Paperclip, Send, Image, AlertTriangle, Clock } from "lucide-react";
import { useAnonymousSessionReactive } from "@/lib/hooks/use-anonymous-session-reactive";
import {
  getAvailableModels,
  getModelInfo,
  type ModelId,
} from "@/lib/ai-providers";

interface ChatInputProps {
  selectedModel: ModelId;
  onModelChange: (model: ModelId) => void;
  message: string;
  onMessageChange: (message: string) => void;
  onSend: () => void;
  isLoading?: boolean;
}

export function ChatInput({
  selectedModel,
  onModelChange,
  message,
  onMessageChange,
  onSend,
  isLoading = false,
}: Readonly<ChatInputProps>) {
  const { isLoaded } = useUser();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Live anonymous session stats (Convex reactive)
  const { isAnonymous, canSendMessage, remainingMessages, messageCount } =
    useAnonymousSessionReactive();

  // Debug logging for message count
  console.log("🎯 Chat Input: Session state:", {
    isAnonymous,
    canSendMessage,
    remainingMessages,
    messageCount,
    isLoaded,
  });

  // Debug: log when remainingMessages or messageCount change
  useEffect(() => {
    console.log(
      "📊 ChatInput: remainingMessages =",
      remainingMessages,
      " messageCount =",
      messageCount,
    );
  }, [remainingMessages, messageCount]);

  // Get available models and current model info
  const availableModels = getAvailableModels();
  const currentModelInfo = getModelInfo(selectedModel);

  const placeholderTexts = [
    "Ask me anything...",
    "Start a conversation...",
    "What's on your mind?",
    "Let's explore ideas together...",
    "Type your message here...",
    "Ready to chat?",
  ];

  // Cycling placeholder animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderTexts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = () => {
    if (!message.trim() || isLoading) return;

    // Check rate limits for anonymous users
    if (isAnonymous && !canSendMessage) {
      // Don't send if rate limited
      return;
    }

    onSend();
  };

  // Get warning color based on remaining messages
  const getWarningLevel = () => {
    if (!isAnonymous || !isLoaded) return null;

    const used = messageCount;
    const total = 10; // Total allowed messages
    const percentage = (used / total) * 100;

    if (percentage >= 90) return { color: "red", level: "critical" };
    if (percentage >= 70) return { color: "orange", level: "warning" };
    if (percentage >= 50) return { color: "yellow", level: "caution" };
    return null;
  };

  const warningLevel = getWarningLevel();
  const isRateLimited = isAnonymous && !canSendMessage;
  const isDisabled = isLoading || isRateLimited;

  return (
    <>
      {/* Rate Limiting Warning for Anonymous Users */}
      {isAnonymous && isLoaded && warningLevel && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`mx-auto w-[90%] px-4 py-2 border-x-2 ${
            warningLevel.color === "red"
              ? "bg-red-50/90 dark:bg-red-950/30 border-red-300 dark:border-red-700"
              : warningLevel.color === "orange"
                ? "bg-orange-50/90 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700"
                : "bg-yellow-50/90 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700"
          }`}
        >
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle
              className={`h-4 w-4 ${
                warningLevel.color === "red"
                  ? "text-red-600 dark:text-red-400"
                  : warningLevel.color === "orange"
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-yellow-600 dark:text-yellow-400"
              }`}
            />
            <span
              className={`font-medium ${
                warningLevel.color === "red"
                  ? "text-red-800 dark:text-red-200"
                  : warningLevel.color === "orange"
                    ? "text-orange-800 dark:text-orange-200"
                    : "text-yellow-800 dark:text-yellow-200"
              }`}
            >
              {warningLevel.level === "critical"
                ? `Only ${remainingMessages} messages left! Sign up for unlimited access.`
                : warningLevel.level === "warning"
                  ? `${remainingMessages} messages remaining. Consider signing up.`
                  : `${remainingMessages} of 10 messages remaining.`}
            </span>
          </div>
        </motion.div>
      )}

      {/* Rate Limit Exceeded Warning */}
      {isRateLimited && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-[90%] px-4 py-3 border-x-2 bg-red-50/90 dark:bg-red-950/30 border-red-300 dark:border-red-700"
        >
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="font-medium text-red-800 dark:text-red-200">
              Message limit reached! Sign up to continue chatting or wait 24
              hours for reset.
            </span>
          </div>
        </motion.div>
      )}

      {/* Clean Chat Input Area */}
      <div className="relative bg-purple-50/30 dark:bg-purple-950/30">
        <div className="mx-auto w-[90%] p-4 border-t-2 border-l-2 border-r-2 border-purple-300 dark:border-purple-700 rounded-t-xl bg-purple-100/90 dark:bg-purple-900/90">
          {/* Main Input Container */}
          <div className="relative">
            <div
              className={`flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-purple-800 border-2 border-purple-300 dark:border-purple-600 shadow-lg shadow-purple-500/10 focus-within:border-purple-500 dark:focus-within:border-purple-400 focus-within:shadow-purple-500/20 transition-all duration-300 ${
                !message.trim()
                  ? "animate-pulse hover:shadow-purple-500/30"
                  : ""
              } ${
                isDisabled
                  ? "opacity-50 cursor-not-allowed border-red-300 dark:border-red-600"
                  : ""
              }`}
            >
              <div className="flex-1 relative">
                {/* Animated Placeholder */}
                <div className="absolute inset-0 flex items-center pointer-events-none">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={placeholderIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{
                        duration: 0.5,
                        ease: "easeInOut",
                      }}
                      className="text-sm text-purple-700 dark:text-purple-300 font-medium ml-3"
                    >
                      {message.trim()
                        ? ""
                        : isRateLimited
                          ? "Message limit reached. Sign up to continue..."
                          : isLoading
                            ? "AI is thinking..."
                            : placeholderTexts[placeholderIndex]}
                    </motion.span>
                  </AnimatePresence>
                </div>

                <Input
                  placeholder=""
                  className="border-none shadow-none bg-transparent focus-visible:ring-0 text-sm placeholder:text-transparent resize-none min-h-[20px] font-medium transition-all duration-500 relative z-10 text-purple-900 dark:text-purple-100"
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isDisabled}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-700 rounded-lg"
                  title="Attach file"
                  disabled={isDisabled}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                  title="Upload image"
                  disabled={isDisabled}
                >
                  <Image className="h-3.5 w-3.5" />
                </Button>

                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || isDisabled}
                  size="icon"
                  className="h-7 w-7 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Model Selector and Status Row */}
          <div className="flex items-center justify-between mt-2 px-1">
            <Select
              value={selectedModel}
              onValueChange={onModelChange}
              disabled={isLoading}
            >
              <SelectTrigger className="group w-auto min-w-48 border-2 border-purple-300 dark:border-purple-600 bg-white dark:bg-purple-800 backdrop-blur-md text-xs text-purple-700 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-700 hover:border-purple-400 dark:hover:border-purple-500 rounded-xl h-8 shadow-lg shadow-purple-500/10 transition-all duration-300 hover:shadow-purple-500/20 hover:scale-[1.02]">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <img
                      src={currentModelInfo.icon}
                      alt={currentModelInfo.name}
                      className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  <span className="font-semibold tracking-wide">
                    {currentModelInfo.name}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent className="border-2 border-purple-300 dark:border-purple-600 bg-white dark:bg-purple-800 backdrop-blur-xl shadow-2xl shadow-purple-500/25 rounded-xl p-1">
                {availableModels.map((modelId) => {
                  const modelInfo = getModelInfo(modelId);
                  return (
                    <SelectItem
                      key={modelId}
                      value={modelId}
                      className={`rounded-lg hover:bg-purple-50 dark:hover:bg-purple-700 transition-all duration-200 hover:scale-[1.02] focus:bg-gradient-to-r ${
                        modelInfo.theme === "blue"
                          ? "focus:from-blue-500/10 focus:to-blue-600/10"
                          : modelInfo.theme === "green"
                            ? "focus:from-green-500/10 focus:to-green-600/10"
                            : "focus:from-orange-500/10 focus:to-orange-600/10"
                      }`}
                    >
                      <div className="flex items-center gap-3 py-1">
                        <div className="relative">
                          <img
                            src={modelInfo.icon}
                            alt={modelInfo.name}
                            className="h-4 w-4"
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
                        <div className="flex-1">
                          <span className="font-medium">{modelInfo.name}</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {modelInfo.description}
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 text-xs text-purple-600/60 dark:text-purple-400/60">
              {/* Anonymous User Message Counter */}
              {isAnonymous && isLoaded && (
                <div
                  className={`px-2 py-1 rounded-lg backdrop-blur-md border transition-all duration-200 ${
                    warningLevel?.color === "red"
                      ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-600 text-red-700 dark:text-red-400"
                      : warningLevel?.color === "orange"
                        ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-600 text-orange-700 dark:text-orange-400"
                        : warningLevel?.color === "yellow"
                          ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-400"
                          : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-600 text-green-700 dark:text-green-400"
                  }`}
                >
                  <span className="font-medium">
                    {remainingMessages}/10 messages
                  </span>
                </div>
              )}

              <div className="px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-800 backdrop-blur-md border border-purple-200 dark:border-purple-600">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-700 text-purple-700 dark:text-purple-200">
                    ↵
                  </kbd>
                  {isLoading ? "generating..." : "to send"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
