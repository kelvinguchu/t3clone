import { SidebarFooter, SidebarSeparator } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignInButton } from "@clerk/nextjs";
import { Crown, LogIn } from "lucide-react";
import type { UserResource } from "@clerk/types";

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
    <SidebarFooter className="p-4">
      <SidebarSeparator className="mb-4 bg-purple-200/50 dark:bg-purple-800/30" />

      {!hasMounted || !isLoaded ? (
        /* Render an invisible placeholder so server & first client render match,
           preventing a hydration mismatch while Clerk finishes loading or until
           after the component has mounted. */
        <div
          className="h-12 w-full opacity-0 pointer-events-none select-none"
          aria-hidden="true"
        />
      ) : user ? (
        <div className="w-full p-3 h-auto bg-purple-100/80 dark:bg-purple-900/30 rounded-xl">
          <div className="flex items-center gap-3 w-full min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar className="h-10 w-10 border-2 border-purple-200 dark:border-purple-800">
                <AvatarImage src={user.imageUrl} />
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-700 text-white font-semibold">
                  {user.firstName?.charAt(0) ??
                    user.emailAddresses[0]?.emailAddress.charAt(0) ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-white dark:border-purple-950 rounded-full" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="font-semibold text-purple-900 dark:text-purple-100 text-sm truncate">
                {user.fullName ??
                  user.firstName ??
                  user.emailAddresses[0]?.emailAddress.split("@")[0] ??
                  "User"}
              </div>
              <div className="flex items-center gap-1">
                <Crown className="h-3 w-3 text-purple-600 flex-shrink-0" />
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium truncate">
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
          <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/25">
            <LogIn className="h-4 w-4 mr-2" />
            Sign In
          </Button>
        </SignInButton>
      )}
    </SidebarFooter>
  );
}
