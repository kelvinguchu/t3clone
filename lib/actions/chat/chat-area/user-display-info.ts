// Type for Clerk user object
export interface ClerkUser {
  fullName?: string | null;
  firstName?: string | null;
  emailAddresses: Array<{
    emailAddress: string;
  }>;
}

export interface UserDisplayInfoParams {
  user: ClerkUser | null | undefined;
  mounted: boolean;
  isAnonymous: boolean;
  remainingMessages: number;
  canSendMessage: boolean;
}

export interface UserDisplayInfo {
  displayName: string;
  greeting: string;
  subtext: string;
}

// Get user display name from Clerk user object
export function getUserDisplayName(user: ClerkUser | null | undefined): string {
  if (!user) return "Guest";
  return (
    user.fullName ||
    user.firstName ||
    user.emailAddresses[0]?.emailAddress.split("@")[0] ||
    "there"
  );
}

// Get user greeting based on auth state
export function getUserGreeting(params: UserDisplayInfoParams): string {
  const { user, mounted, isAnonymous, remainingMessages } = params;

  if (!mounted || !user) return "Hey there!";
  if (isAnonymous) {
    return `Hey there! (${remainingMessages}/10 messages left)`;
  }
  return `Hey ${getUserDisplayName(user)}!`;
}

// Get user subtext based on auth state and message limits
export function getUserSubtext(params: UserDisplayInfoParams): string {
  const { user, mounted, isAnonymous, canSendMessage } = params;

  if (!mounted || !user) return "Ready to explore ideas together?";
  if (isAnonymous) {
    if (!canSendMessage) {
      return "Sign up to continue chatting or wait 24 hours for reset";
    }
    return "Sign up for unlimited conversations and message history";
  }
  return "Ready to explore ideas together?";
}

// Get all user display info at once
export function getUserDisplayInfo(
  params: UserDisplayInfoParams,
): UserDisplayInfo {
  return {
    displayName: getUserDisplayName(params.user),
    greeting: getUserGreeting(params),
    subtext: getUserSubtext(params),
  };
}
