import { SidebarFooter, SidebarSeparator } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SignInButton } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import type { UserResource } from "@clerk/types";
import { toast } from "sonner";
import { chatBus } from "@/lib/events/chat-bus";
import { useAnonymousSession } from "@/lib/contexts/anonymous-session-context";
import { usePlanLimits } from "@/lib/hooks/use-plan-limits";

export type ChatSidebarFooterProps = {
  hasMounted: boolean;
  isLoaded: boolean;
  user: UserResource | null | undefined;
  handleSignOut: () => void;
};

export function ChatSidebarFooter({
  hasMounted,
  isLoaded,
  user,
}: Readonly<ChatSidebarFooterProps>) {
  const { canSendMessage, remainingMessages, messageCount } =
    useAnonymousSession();
  const planLimits = usePlanLimits();

  // Use the same logic as chat-area.tsx - anonymous users use anonymous session data, authenticated users use plan limits
  const isUserAnonymous = hasMounted && isLoaded && !user;
  const effectiveCanSend = isUserAnonymous
    ? canSendMessage
    : planLimits.canSend;
  const effectiveUsed = isUserAnonymous ? messageCount : planLimits.used;
  const effectiveTotal = isUserAnonymous ? 10 : planLimits.total; // Anonymous users have 10 message limit
  const effectiveRemaining = isUserAnonymous
    ? remainingMessages
    : planLimits.remaining;
  const effectivePlan = isUserAnonymous ? "Anonymous" : planLimits.plan;

  return (
    <SidebarFooter className="p-2">
      <SidebarSeparator className="mb-2 bg-purple-200/50 dark:bg-dark-purple-accent/30" />

      {!hasMounted || !isLoaded ? (
        /* Render an invisible placeholder so server & first client render match,
           preventing a hydration mismatch while Clerk finishes loading or until
           after the component has mounted. */
        <div
          className="h-8 w-full opacity-0 pointer-events-none select-none"
          aria-hidden="true"
        />
      ) : (
        <div className="space-y-3">
          {/* User Profile Section - only for authenticated users */}
          {user && (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-purple-200 dark:border-dark-purple-accent">
                <AvatarImage src={user.imageUrl} />
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-700 dark:from-dark-purple-glow dark:to-dark-purple-light text-white font-semibold">
                  {user.firstName?.charAt(0) ??
                    user.emailAddresses[0]?.emailAddress.charAt(0) ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-purple-900 dark:text-purple-100 truncate text-sm">
                  {user.fullName ?? user.firstName ?? "User"}
                </h2>
                <Badge
                  variant="secondary"
                  className="mt-1 bg-purple-200 dark:bg-dark-bg-tertiary text-purple-800 dark:text-purple-200 text-xs"
                >
                  {planLimits.isLoading
                    ? "Loading…"
                    : effectivePlan === "pro"
                      ? "Pro Plan"
                      : effectivePlan === "Anonymous"
                        ? "Anonymous"
                        : "Free Plan"}
                </Badge>
              </div>
            </div>
          )}

          {/* Dynamic Usage Stats - for both authenticated and anonymous users */}
          <div className="bg-purple-50 dark:bg-dark-bg rounded-lg p-3 border border-purple-200 dark:border-dark-purple-accent">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-purple-800 dark:text-purple-200">
                {isUserAnonymous
                  ? `${effectiveUsed}/${effectiveTotal} messages`
                  : planLimits.isLoading
                    ? "Loading..."
                    : effectiveTotal === -1
                      ? `${effectiveUsed} messages (unlimited)`
                      : `${effectiveUsed}/${effectiveTotal} messages`}
              </span>
              <span className="text-xs text-purple-600 dark:text-purple-400">
                {isUserAnonymous
                  ? "Resets daily"
                  : effectivePlan === "pro"
                    ? "Resets monthly"
                    : "Resets daily"}
              </span>
            </div>
            <div className="w-full bg-purple-200 dark:bg-dark-bg-tertiary rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isUserAnonymous
                    ? effectiveRemaining <= 2
                      ? "bg-red-500"
                      : effectiveRemaining <= 5
                        ? "bg-orange-500"
                        : "bg-purple-600"
                    : planLimits.percentage >= 90
                      ? "bg-red-500"
                      : planLimits.percentage >= 70
                        ? "bg-orange-500"
                        : "bg-purple-600"
                }`}
                style={{
                  width: isUserAnonymous
                    ? `${Math.min(100, (effectiveUsed / effectiveTotal) * 100)}%`
                    : effectiveTotal === -1
                      ? "0%"
                      : `${Math.min(100, planLimits.percentage)}%`,
                }}
              ></div>
            </div>
            {isUserAnonymous ? (
              !effectiveCanSend && (
                <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                  Daily limit reached. Resets at midnight.
                </div>
              )
            ) : (
              <>
                {planLimits.error && (
                  <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                    {planLimits.error}
                  </div>
                )}
                {!planLimits.canSend && planLimits.total !== -1 && (
                  <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                    {planLimits.plan === "pro"
                      ? "Monthly limit reached. Resets next month."
                      : "Daily limit reached. Resets at midnight."}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sign In Button - only for anonymous users */}
          {!user && (
            <SignInButton
              mode="modal"
              forceRedirectUrl="/chat"
              signUpForceRedirectUrl="/chat"
            >
              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 dark:from-dark-purple-glow dark:to-dark-purple-light hover:from-purple-700 hover:to-purple-800 dark:hover:from-dark-purple-light dark:hover:to-dark-purple-glow text-white shadow-lg shadow-purple-500/25 dark:shadow-dark-purple-glow/30"
                onClick={async () => {
                  const id = toast.loading("Saving your chat before sign-in…");

                  chatBus.emit("flushRequest");

                  await Promise.race([
                    new Promise<void>((res) => {
                      const handler = () => {
                        chatBus.off("flushComplete", handler);
                        res();
                      };
                      chatBus.on("flushComplete", handler);
                    }),
                    new Promise((res) => setTimeout(res, 2000)),
                  ]);

                  toast.success("Chat saved!", { id });
                }}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </SignInButton>
          )}
        </div>
      )}
    </SidebarFooter>
  );
}
