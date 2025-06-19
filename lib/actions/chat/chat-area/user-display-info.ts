// Type for Clerk user object
export interface ClerkUser {
  fullName?: string | null;
  firstName?: string | null;
  emailAddresses: Array<{
    emailAddress: string;
  }>;
}

import type { UserResource } from "@clerk/types";

export interface UserDisplayInfoParams {
  user: UserResource | null | undefined;
  isAnonymous: boolean;
  canSendMessage: boolean;
  remainingMessages: number;
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
export function getUserGreeting({
  user,
  isAnonymous,
  remainingMessages,
}: UserDisplayInfoParams): string {
  if (isAnonymous) {
    return remainingMessages > 0
      ? "Welcome to Anonymous Chat"
      : "Message Limit Reached";
  }
  return user?.firstName ? `Hello, ${user.firstName}` : "Welcome Back";
}

// Get user subtext based on auth state and message limits
export function getUserSubtext({
  isAnonymous,
  canSendMessage,
  remainingMessages,
}: UserDisplayInfoParams): string {
  if (isAnonymous) {
    if (!canSendMessage) {
      return "Please sign up or log in to continue the conversation.";
    }
    return `You have ${remainingMessages} free messages remaining.`;
  }
  return "How can I help you today?";
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
