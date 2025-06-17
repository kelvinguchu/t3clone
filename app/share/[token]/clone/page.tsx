import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function CloneThreadPage({ params }: Props) {
  const { token } = await params;
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    // Store the clone intent in the redirect URL
    return redirectToSignIn({
      returnBackUrl: `/auth/callback/share?token=${token}&action=clone`,
    });
  }

  // User is authenticated, redirect to clone handler
  redirect(`/auth/callback/share?token=${token}&action=clone`);
}

// Metadata for clone page
export function generateMetadata() {
  return {
    title: "Clone Conversation",
    description: "Create your own copy of this shared conversation",
    robots: "noindex",
  };
}
