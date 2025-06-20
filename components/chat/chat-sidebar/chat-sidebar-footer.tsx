import { SidebarFooter, SidebarSeparator } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignInButton } from "@clerk/nextjs";
import { Crown, LogIn } from "lucide-react";
import type { UserResource } from "@clerk/types";
import { toast } from "sonner";
import { chatBus } from "@/lib/events/chat-bus";

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
      ) : user ? (
        <div className="w-full p-2 h-auto bg-purple-100/80 dark:bg-dark-bg-tertiary/50 rounded-xl border border-transparent dark:border-dark-purple-accent/20">
          <div className="flex items-center gap-3 w-full min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar className="h-10 w-10 border-2 border-purple-200 dark:border-dark-purple-accent">
                <AvatarImage src={user.imageUrl} />
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-700 dark:from-dark-purple-glow dark:to-dark-purple-light text-white font-semibold">
                  {user.firstName?.charAt(0) ??
                    user.emailAddresses[0]?.emailAddress.charAt(0) ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-white dark:border-dark-bg-tertiary rounded-full" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="font-semibold text-purple-900 dark:text-slate-200 text-sm truncate">
                {user.fullName ??
                  user.firstName ??
                  user.emailAddresses[0]?.emailAddress.split("@")[0] ??
                  "User"}
              </div>
              <div className="flex items-center gap-1">
                <Crown className="h-3 w-3 text-purple-600 dark:text-dark-purple-glow flex-shrink-0" />
                <span className="text-xs text-purple-600 dark:text-slate-400 font-medium truncate">
                  {(user.publicMetadata?.plan as string) || "Free Plan"}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <SignInButton
          mode="modal"
          forceRedirectUrl="/chat"
          signUpForceRedirectUrl="/chat"
        >
          <Button
            className="w-full bg-gradient-to-r mb-4 md:mb-0 from-purple-600 to-purple-700 dark:from-dark-purple-glow dark:to-dark-purple-light hover:from-purple-700 hover:to-purple-800 dark:hover:from-dark-purple-light dark:hover:to-dark-purple-glow text-white shadow-lg shadow-purple-500/25 dark:shadow-dark-purple-glow/30"
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
    </SidebarFooter>
  );
}
