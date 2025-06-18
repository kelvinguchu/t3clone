import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You're offline - T3 Chat",
  description:
    "You're currently offline. Please check your internet connection.",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white dark:from-purple-950 dark:to-purple-900">
      <div className="max-w-md mx-auto text-center p-8">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-purple-500 dark:text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            You&apos;re offline
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            It looks like you&apos;ve lost your internet connection. Some
            features may not be available.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200"
          >
            Try Again
          </button>

          <button
            onClick={() => window.history.back()}
            className="w-full px-4 py-2 border border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900 rounded-lg transition-colors duration-200"
          >
            Go Back
          </button>
        </div>

        <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>
            Cached pages and previously viewed content may still be available.
          </p>
        </div>
      </div>
    </div>
  );
}
