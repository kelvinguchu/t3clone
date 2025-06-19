"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { useAnonymousSession } from "@/lib/contexts/anonymous-session-context";

export interface ThreadCreatorReturn {
  createThread: (args: {
    title: string;
    model: string;
  }) => Promise<Id<"threads">>;
  createAnonymousThread: (args: {
    title: string;
    model: string;
  }) => Promise<Id<"threads">>;
  isAnonymousSession: boolean;
}

/**
 * Custom hook for thread creation with optimistic updates
 * Extracted from chat-sidebar.tsx
 */
export function useThreadCreator(
  user: { id: string } | null | undefined,
): ThreadCreatorReturn {
  const { sessionId, isAnonymous } = useAnonymousSession();

  // Mutations with optimistic updates
  const createThread = useMutation(
    api.threads.createThread,
  ).withOptimisticUpdate((localStore, args) => {
    if (!user) return;

    const tempId = ("optimistic-" +
      Math.random().toString(36).slice(2)) as Id<"threads">;
    const now = Date.now();

    const newThread = {
      _id: tempId,
      _creationTime: now,
      title: args.title,
      userId: user.id,
      isAnonymous: false,
      sessionId: undefined,
      model: args.model,
      createdAt: now,
      updatedAt: now,
    } as unknown as Doc<"threads">;

    const existing =
      localStore.getQuery(api.threads.getUserThreads, { userId: user.id }) ??
      [];
    localStore.setQuery(api.threads.getUserThreads, { userId: user.id }, [
      newThread,
      ...existing,
    ]);
  });

  const createAnonymousThreadMutation = useMutation(
    api.threads.createAnonymousThread,
  ).withOptimisticUpdate((localStore, args) => {
    const tempId = ("optimistic-" +
      Math.random().toString(36).slice(2)) as Id<"threads">;
    const now = Date.now();

    const newThread = {
      _id: tempId,
      _creationTime: now,
      title: args.title,
      userId: undefined,
      isAnonymous: true,
      sessionId: args.sessionId,
      model: args.model,
      createdAt: now,
      updatedAt: now,
    } as unknown as Doc<"threads">;

    const existing =
      localStore.getQuery(api.threads.getAnonymousThreads, {
        sessionId: args.sessionId,
      }) ?? [];
    localStore.setQuery(
      api.threads.getAnonymousThreads,
      { sessionId: args.sessionId },
      [newThread, ...existing],
    );
  });

  const createAnonymousThread = async (args: {
    title: string;
    model: string;
  }) => {
    if (!sessionId) {
      throw new Error("Session ID is required for anonymous thread creation.");
    }
    return createAnonymousThreadMutation({ ...args, sessionId });
  };

  return {
    createThread,
    createAnonymousThread,
    isAnonymousSession: isAnonymous,
  };
}
