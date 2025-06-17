import { useState } from "react";
import {
  MapPin,
  Code2,
  Lightbulb,
  Wand2,
  Brain,
  Rocket,
  UserIcon,
  Search,
  BookOpen,
} from "lucide-react";

const promptCategories = {
  kenya: {
    title: "Kenya",
    icon: MapPin,
    prompts: [
      "Tell me about Kenyan culture and traditions",
      "What are the major tourist attractions in Kenya?",
      "Explain Kenya's wildlife and national parks",
      "Describe Kenyan cuisine and popular dishes",
    ],
  },
  explore: {
    title: "Explore",
    icon: Search,
    prompts: [
      "Explain quantum physics",
      "What are black holes?",
      "History of ancient civilizations",
      "How does AI work?",
    ],
  },
  code: {
    title: "Code",
    icon: Code2,
    prompts: [
      "Write a Python function",
      "Debug my JavaScript",
      "Explain React hooks",
      "SQL query optimization",
    ],
  },
  learn: {
    title: "Learn",
    icon: BookOpen,
    prompts: [
      "Study plan for mathematics",
      "Language learning tips",
      "Explain machine learning",
      "Business strategy basics",
    ],
  },
};

export type ChatWelcomeScreenProps = {
  mounted: boolean;
  isLoaded: boolean;
  isAnonymous: boolean;
  remainingMessages: number;
  canSendMessage: boolean;
  isLoading: boolean;
  floatingColors: {
    primary: string;
    secondary: string;
  };
  getUserGreeting: () => string;
  getUserSubtext: () => string;
  handleQuickPrompt: (prompt: string) => void;
};

export function ChatWelcomeScreen({
  mounted,
  isLoaded,
  isAnonymous,
  remainingMessages,
  canSendMessage,
  isLoading,
  floatingColors,
  getUserGreeting,
  getUserSubtext,
  handleQuickPrompt,
}: Readonly<ChatWelcomeScreenProps>) {
  const [activeTab, setActiveTab] =
    useState<keyof typeof promptCategories>("kenya");
  return (
    <div className="h-full flex flex-col justify-center items-center p-2 sm:p-3 md:p-4 lg:p-6 relative mx-auto w-full sm:w-[95%] md:w-[90%] lg:w-[80%]">
      {/* Floating Background Elements with Model Theme */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className={`absolute top-1/4 left-1/4 w-12 h-12 sm:w-16 sm:h-16 md:w-24 md:h-24 lg:w-32 lg:h-32 rounded-full blur-xl sm:blur-2xl md:blur-3xl animate-pulse transition-colors duration-1000 ${floatingColors.primary}`}
        />
        <div
          className={`absolute bottom-1/3 right-1/4 w-8 h-8 sm:w-12 sm:h-12 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full blur-lg sm:blur-xl md:blur-2xl animate-pulse delay-1000 transition-colors duration-1000 ${floatingColors.secondary}`}
        />
        <div className="absolute top-1/2 right-1/3 w-6 h-6 sm:w-10 sm:h-10 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-pink-200/20 dark:bg-pink-800/10 rounded-full blur-md sm:blur-lg md:blur-xl animate-pulse delay-2000" />
      </div>

      <div className="flex-1 flex flex-col justify-center items-center">
        {/* Central Welcome Area */}
        <div className="text-center mb-3 sm:mb-4 md:mb-6 lg:mb-8 z-10">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 md:mb-4">
            <div className="p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg md:rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 shadow-lg shadow-purple-500/25 animate-bounce">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-white" />
            </div>
            <div className="p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg md:rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-blue-500/25 animate-bounce delay-300">
              <Brain className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-white" />
            </div>
            {mounted && isLoaded && isAnonymous && (
              <div className="p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg md:rounded-xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/25 animate-bounce delay-500">
                <UserIcon className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-white" />
              </div>
            )}
            <div className="p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg md:rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 shadow-lg shadow-pink-500/25 animate-bounce delay-700">
              <Wand2 className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-white" />
            </div>
          </div>

          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold mb-1 sm:mb-2">
            <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-purple-800 bg-clip-text text-transparent">
              {getUserGreeting()}
            </span>
          </h1>
          <p
            className={`text-xs sm:text-sm md:text-base font-medium mb-3 sm:mb-4 md:mb-6 lg:mb-8 px-1 sm:px-2 ${
              isAnonymous && !canSendMessage
                ? "text-red-600/80 dark:text-red-400/80"
                : isAnonymous
                  ? "text-orange-600/80 dark:text-orange-400/80"
                  : "text-purple-600/80 dark:text-purple-400/80"
            }`}
          >
            {getUserSubtext()}
          </p>

          {/* Sign up prompt for anonymous users with low messages */}
          {mounted && isAnonymous && remainingMessages <= 3 && (
            <div className="mb-3 sm:mb-4 md:mb-6 p-2 sm:p-3 md:p-4 mx-1 sm:mx-2 md:mx-0 rounded-md sm:rounded-lg md:rounded-xl bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border border-orange-200 dark:border-orange-700">
              <p className="text-xs sm:text-sm text-orange-800 dark:text-orange-200 font-medium mb-1 sm:mb-2">
                ⚡ Running low on messages!
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Sign up to get unlimited conversations, message history, and
                access to all features.
              </p>
            </div>
          )}

          {/* Category Selection */}
          <div className="w-full max-w-2xl px-1 sm:px-2 md:px-0">
            <div className="flex justify-center gap-1 sm:gap-2 mb-4 sm:mb-5 md:mb-6 overflow-x-auto">
              {Object.entries(promptCategories).map(([key, category]) => {
                const IconComponent = category.icon;
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() =>
                      setActiveTab(key as keyof typeof promptCategories)
                    }
                    className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? "bg-purple-600 text-white"
                        : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50"
                    }`}
                  >
                    <IconComponent className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline sm:inline">
                      {category.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Prompts for Active Tab */}
            <div className="w-full">
              <ul className="space-y-1 sm:space-y-1.5">
                {promptCategories[activeTab].prompts.map((prompt, index) => (
                  <li key={index}>
                    <button
                      onClick={() => handleQuickPrompt(prompt)}
                      disabled={(isAnonymous && !canSendMessage) || isLoading}
                      className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md sm:rounded-lg transition-all duration-200 ${
                        (isAnonymous && !canSendMessage) || isLoading
                          ? "bg-gray-100/80 dark:bg-gray-900/20 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                          : "bg-purple-50/80 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 hover:bg-purple-100/80 dark:hover:bg-purple-800/30 hover:scale-[1.01] sm:hover:scale-[1.02] hover:shadow-md"
                      }`}
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute bottom-12 sm:bottom-16 md:bottom-20 left-2 sm:left-4 md:left-10 opacity-20 sm:opacity-30">
          <Rocket className="h-2 w-2 sm:h-3 sm:w-3 md:h-4 md:w-4 text-purple-400 animate-pulse" />
        </div>
        <div className="absolute top-12 sm:top-16 md:top-20 right-4 sm:right-8 md:right-16 opacity-20 sm:opacity-30">
          <Code2 className="h-2 w-2 sm:h-3 sm:w-3 md:h-4 md:w-4 text-blue-400 animate-pulse delay-500" />
        </div>
        <div className="absolute bottom-20 sm:bottom-24 md:bottom-32 right-3 sm:right-6 md:right-12 opacity-20 sm:opacity-30">
          <Lightbulb className="h-2 w-2 sm:h-3 sm:w-3 md:h-4 md:w-4 text-yellow-400 animate-pulse delay-1000" />
        </div>
      </div>
    </div>
  );
}
