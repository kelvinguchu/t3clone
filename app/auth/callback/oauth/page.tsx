"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const action = searchParams.get("action");

  useEffect(() => {
    // Set up a timer to redirect after OAuth completion
    const timer = setTimeout(() => {
      if (token && action) {
        router.push(`/auth/callback/share?token=${token}&action=${action}`);
      } else {
        router.push("/");
      }
    }, 3000); // Give more time for OAuth completion

    return () => clearTimeout(timer);
  }, [token, action, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Completing authentication...</p>

        {/* This component handles the final step of Clerk's OAuth flow */}
        <AuthenticateWithRedirectCallback />
      </div>
    </div>
  );
}
