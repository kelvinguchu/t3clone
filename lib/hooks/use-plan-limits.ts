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

  // Fetch plan statistics from Convex – server will resolve the correct plan
  const stats = useQuery(
    api.users.getUserPlanStats,
    user && isLoaded ? { userId: user.id } : "skip",
  );

  // Mutation to increment usage (server resolves the correct plan)
  const incrementUsageMutation = useMutation(api.users.incrementPlanUsage);

  const incrementUsage = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      setError(null);
      const result = await incrementUsageMutation({ userId: user.id });

      if (!result.success) {
        setError("Message limit exceeded");
        return false;
      }

      return true;
    } catch (err) {
      console.error("Error incrementing usage:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    }
  }, [user, incrementUsageMutation]);

  const refreshLimits = useCallback(() => {
    setError(null);
  }, []);

  // While Clerk or Convex data is loading, return sensible defaults
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
      remaining: 1500,
      total: 1500,
      percentage: 0,
      resetTime: Date.now() + 24 * 60 * 60 * 1000,
      plan: "free",
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
