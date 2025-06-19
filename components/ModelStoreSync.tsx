"use client";

import { useEffect, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useModelStore } from "@/lib/stores/model-store";
import type { ModelId } from "@/lib/ai-providers";

/**
 * ModelStoreSync keeps the Zustand model store in sync with the database
 * for the currently signed-in user. It should be rendered once at the
 * root of the client tree (e.g. in `app/layout.tsx`).
 */
export function ModelStoreSync({ children }: { children: ReactNode }) {
  const { user } = useUser();

  const { _hasHydrated, setUserId, setEnabledModels, setDbSynced } =
    useModelStore();

  // Subscribe to the list of enabled models for the current user.
  const userEnabledModels = useQuery(
    api.userPreferences.getEnabledModels,
    user ? { userId: user.id } : "skip",
  );

  // Keep the userId inside the store up to date.
  useEffect(() => {
    setUserId(user ? user.id : null);
  }, [user, setUserId]);

  // Hydrate the enabled models once both the store and Clerk are ready.
  useEffect(() => {
    if (!_hasHydrated || !user) return;

    // Still loading.
    if (userEnabledModels === undefined) return;

    if (userEnabledModels === null) {
      // No preferences found – mark as synced so the UI can proceed.
      setDbSynced(true);
      return;
    }

    // We have a preference list from Convex – load it into the store.
    setEnabledModels(userEnabledModels as ModelId[]);
    setDbSynced(true);
  }, [_hasHydrated, user, userEnabledModels, setEnabledModels, setDbSynced]);

  return <>{children}</>;
}
