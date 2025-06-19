import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCallbackHandler } from "@/components/share/auth-callback-handler";

interface Props {
  searchParams: Promise<{
    token?: string;
    action?: string;
    __clerk_db_jwt?: string; // Clerk's internal JWT parameter
  }>;
}

export default async function AuthCallbackPage({ searchParams }: Props) {
  const { userId } = await auth();
  const params = await searchParams;

  // Handle Clerk's OAuth completion - if we have the JWT parameter,
  // this means Clerk is completing the OAuth flow
  if (params.__clerk_db_jwt && !userId) {
    // Still in the OAuth flow, let Clerk complete the authentication
    // Redirect to a simple callback page that will handle the completion
    redirect(
      `/auth/callback/oauth?${new URLSearchParams(params as Record<string, string>).toString()}`,
    );
  }

  // Must be authenticated to access this page
  if (!userId) {
    // If no JWT parameter and no user, redirect to sign-in
    const redirectUrl = `/auth/callback/share?${new URLSearchParams(params as Record<string, string>).toString()}`;
    redirect(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
  }

  const { token, action } = params;

  // Validate required parameters
  if (!token || !action) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white dark:from-dark-bg dark:to-purple-900 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <Suspense fallback={<AuthCallbackSkeleton />}>
          <AuthCallbackHandler token={token} action={action} userId={userId} />
        </Suspense>
      </div>
    </div>
  );
}

// Loading skeleton for auth callback
function AuthCallbackSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="border-purple-200 dark:border-purple-700 bg-white/80 dark:bg-purple-900/40 backdrop-blur-sm rounded-lg border p-6">
        <div className="text-center space-y-4">
          <div className="mx-auto p-3 bg-purple-100 dark:bg-purple-800/50 rounded-full w-fit">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-300 border-t-purple-600"></div>
          </div>
          <div className="space-y-2">
            <div className="h-6 bg-purple-200 dark:bg-purple-700 rounded w-3/4 mx-auto animate-pulse"></div>
            <div className="h-4 bg-purple-100 dark:bg-purple-800 rounded w-1/2 mx-auto animate-pulse"></div>
          </div>
          <div className="flex items-center justify-center pt-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Metadata
export function generateMetadata() {
  return {
    title: "Processing Authentication",
    description: "Processing your authentication request",
    robots: "noindex",
  };
}
