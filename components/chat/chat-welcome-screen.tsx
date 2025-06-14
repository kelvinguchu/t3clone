import {
  Sparkles,
  Code2,
  Lightbulb,
  Wand2,
  Brain,
  Rocket,
  UserIcon,
} from "lucide-react";

const quickPrompts = [
  "Explain quantum computing",
  "Write a Python function",
  "Help me brainstorm ideas",
  "Analyze this data",
  "Create a story",
  "Debug my code",
  "Plan my day",
  "Write an email",
];

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
  return (
    <div className="h-full flex flex-col justify-center items-center p-6 relative">
      {/* Floating Background Elements with Model Theme */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className={`absolute top-1/4 left-1/4 w-32 h-32 rounded-full blur-3xl animate-pulse transition-colors duration-1000 ${floatingColors.primary}`}
        />
        <div
          className={`absolute bottom-1/3 right-1/4 w-24 h-24 rounded-full blur-2xl animate-pulse delay-1000 transition-colors duration-1000 ${floatingColors.secondary}`}
        />
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-pink-200/20 dark:bg-pink-800/10 rounded-full blur-xl animate-pulse delay-2000" />
      </div>

      <div className="flex-1 flex flex-col justify-center items-center">
        {/* Central Welcome Area */}
        <div className="text-center mb-8 z-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 shadow-lg shadow-purple-500/25 animate-bounce">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-blue-500/25 animate-bounce delay-300">
              <Brain className="h-6 w-6 text-white" />
            </div>
            {(() => {
              const show = mounted && isLoaded && isAnonymous;
              return (
                <div
                  className={`p-2 rounded-xl ${
                    show
                      ? "bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/25 animate-bounce delay-500"
                      : "opacity-0"
                  }`}
                  aria-hidden={show ? "false" : "true"}
                >
                  {show && <UserIcon className="h-6 w-6 text-white" />}
                </div>
              );
            })()}
            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 shadow-lg shadow-pink-500/25 animate-bounce delay-700">
              <Wand2 className="h-6 w-6 text-white" />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-purple-800 bg-clip-text text-transparent">
              {getUserGreeting()}
            </span>
          </h1>
          <p
            className={`font-medium mb-8 ${
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
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border border-orange-200 dark:border-orange-700">
              <p className="text-sm text-orange-800 dark:text-orange-200 font-medium mb-2">
                ⚡ Running low on messages!
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Sign up to get unlimited conversations, message history, and
                access to all features.
              </p>
            </div>
          )}

          {/* Floating Quick Prompts */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
            {quickPrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => handleQuickPrompt(prompt)}
                disabled={(isAnonymous && !canSendMessage) || isLoading}
                className={`px-3 py-1.5 text-xs rounded-full transition-all duration-200 border ${
                  (isAnonymous && !canSendMessage) || isLoading
                    ? "bg-gray-100/80 dark:bg-gray-900/20 text-gray-400 dark:text-gray-600 border-gray-200/50 dark:border-gray-800/30 cursor-not-allowed"
                    : "bg-purple-100/80 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-200/80 dark:hover:bg-purple-800/30 hover:scale-105 border-purple-200/50 dark:border-purple-800/30 hover:border-purple-300 dark:hover:border-purple-700"
                }`}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute bottom-20 left-10 opacity-30">
          <Rocket className="h-4 w-4 text-purple-400 animate-pulse" />
        </div>
        <div className="absolute top-20 right-16 opacity-30">
          <Code2 className="h-4 w-4 text-blue-400 animate-pulse delay-500" />
        </div>
        <div className="absolute bottom-32 right-12 opacity-30">
          <Lightbulb className="h-4 w-4 text-yellow-400 animate-pulse delay-1000" />
        </div>
      </div>
    </div>
  );
}
