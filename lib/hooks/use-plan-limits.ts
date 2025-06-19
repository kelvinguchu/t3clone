import { useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface PlanLimits {
  canSend: boolean;
  used: number;
  remaining: number;
  total: number;
  percentage: number;
  resetTime: number;
  plan: string;
  isLoading: boolean;
  error: string | null;
}

interface UsePlanLimitsReturn extends PlanLimits {
  incrementUsage: () => Promise<boolean>;
  refreshLimits: () => void;
}

export function usePlanLimits(): UsePlanLimitsReturn {
  const { user, isLoaded } = useUser();
  const [error, setError] = useState<string | null>(null);

  // Get user's plan from Clerk metadata
  const getUserPlan = useCallback(() => {
    if (!user) return "free";
    return (user.publicMetadata?.plan as string) || "free";
  }, [user]);

  const plan = getUserPlan();

  // Use Convex query to get current plan stats
  const stats = useQuery(
    api.users.getUserPlanStats,
    user && isLoaded ? { userId: user.id, plan } : "skip",
  );

  // Use Convex mutation to increment usage
  const incrementUsageMutation = useMutation(api.users.incrementPlanUsage);

  // Increment usage count
  const incrementUsage = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      setError(null);
      const result = await incrementUsageMutation({
        userId: user.id,
        plan,
      });

      if (!result.success) {
        setError("Message limit exceeded");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error incrementing usage:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
      return false;
    }
  }, [user, plan, incrementUsageMutation]);

  // Refresh limits (the query will automatically refetch)
  const refreshLimits = useCallback(() => {
    // Convex queries auto-refresh, but we can clear errors
    setError(null);
  }, []);

  // Determine loading state based on user loading and stats availability

  // Return combined state
  if (!isLoaded || !user) {
    return {
      canSend: false,
      used: 0,
      remaining: 0,
      total: 25,
      percentage: 0,
      resetTime: Date.now() + 24 * 60 * 60 * 1000,
      plan: "free",
      isLoading: !isLoaded,
      error: null,
      incrementUsage,
      refreshLimits,
    };
  }

  if (!stats) {
    return {
      canSend: true,
      used: 0,
      remaining: plan === "pro" ? 1500 : 25,
      total: plan === "pro" ? 1500 : 25,
      percentage: 0,
      resetTime: Date.now() + 24 * 60 * 60 * 1000,
      plan,
      isLoading: true,
      error,
      incrementUsage,
      refreshLimits,
    };
  }

  return {
    canSend: stats.remaining > 0 || stats.total === -1,
    used: stats.used,
    remaining: stats.remaining,
    total: stats.total,
    percentage: stats.percentage,
    resetTime: stats.resetTime,
    plan: stats.plan,
    isLoading: false,
    error,
    incrementUsage,
    refreshLimits,
  };
}
