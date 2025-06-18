import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";

export function SharePageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white dark:bg-dark-bg">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-dark-bg-secondary/80 backdrop-blur-md border-b border-purple-200 dark:border-dark-purple-accent">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: App branding */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-600 rounded-lg">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-purple-800 dark:text-purple-200 text-base sm:text-lg">
                  T3 Chat
                </h1>
              </div>
            </div>

            {/* Right: Action buttons skeleton */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Skeleton className="h-8 w-8 sm:w-16 bg-purple-200 dark:bg-dark-bg" />
              <Skeleton className="h-8 w-8 sm:w-20 bg-purple-200 dark:bg-dark-bg" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Thread Info Card skeleton */}
        <div className="bg-white/70 dark:bg-dark-bg-secondary/70 rounded-lg p-4 mb-6 border border-purple-200 dark:border-dark-purple-accent backdrop-blur-sm">
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4 bg-purple-200 dark:bg-dark-bg" />
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-4 w-24 bg-purple-100 dark:bg-gray-800" />
              <Skeleton className="h-4 w-16 bg-purple-100 dark:bg-gray-800" />
              <Skeleton className="h-6 w-20 bg-purple-100 dark:bg-gray-800 rounded-full" />
            </div>
          </div>
        </div>

        {/* Messages skeleton */}
        <div className="bg-white/50 dark:bg-dark-bg-secondary/50 rounded-lg border border-purple-200 dark:border-dark-purple-accent backdrop-blur-sm p-4">
          <div className="space-y-6">
            {/* User message */}
            <div className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full bg-purple-200 dark:bg-dark-bg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-16 bg-purple-100 dark:bg-gray-800" />
                <Skeleton className="h-20 w-full bg-purple-100 dark:bg-gray-800 rounded-lg" />
              </div>
            </div>

            {/* Assistant message */}
            <div className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full bg-purple-200 dark:bg-dark-bg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20 bg-purple-100 dark:bg-gray-800" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full bg-purple-100 dark:bg-gray-800" />
                  <Skeleton className="h-4 w-5/6 bg-purple-100 dark:bg-gray-800" />
                  <Skeleton className="h-4 w-4/5 bg-purple-100 dark:bg-gray-800" />
                  <Skeleton className="h-4 w-3/4 bg-purple-100 dark:bg-gray-800" />
                </div>
              </div>
            </div>

            {/* Another user message */}
            <div className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full bg-purple-200 dark:bg-dark-bg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-16 bg-purple-100 dark:bg-gray-800" />
                <Skeleton className="h-16 w-4/5 bg-purple-100 dark:bg-gray-800 rounded-lg" />
              </div>
            </div>

            {/* Another assistant message */}
            <div className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full bg-purple-200 dark:bg-dark-bg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20 bg-purple-100 dark:bg-gray-800" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full bg-purple-100 dark:bg-gray-800" />
                  <Skeleton className="h-4 w-11/12 bg-purple-100 dark:bg-gray-800" />
                  <Skeleton className="h-4 w-4/5 bg-purple-100 dark:bg-gray-800" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
