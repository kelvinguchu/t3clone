"use client";

import { createContext, useContext, ReactNode } from "react";
import {
  useAnonymousSessionReactive,
  type UseAnonymousSessionReactiveReturn,
} from "@/lib/hooks/use-anonymous-session-reactive";

const AnonymousSessionContext =
  createContext<UseAnonymousSessionReactiveReturn | null>(null);

interface AnonymousSessionProviderProps {
  children: ReactNode;
}

export function AnonymousSessionProvider({
  children,
}: AnonymousSessionProviderProps) {
  // Single hook call for the entire app
  const sessionData = useAnonymousSessionReactive();

  return (
    <AnonymousSessionContext.Provider value={sessionData}>
      {children}
    </AnonymousSessionContext.Provider>
  );
}

export function useAnonymousSession() {
  const context = useContext(AnonymousSessionContext);
  if (!context) {
    throw new Error(
      "useAnonymousSession must be used within AnonymousSessionProvider",
    );
  }
  return context;
}
