import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // Check if the app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstallable(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Update UI to notify the user they can install the PWA
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      // Clear the deferredPrompt so it can be garbage collected
      setDeferredPrompt(null);
      // Hide the app install button
      setIsInstallable(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        // The PWA will be installed, no need to do anything here.
        // The 'appinstalled' event will be fired.
      }

      // We've used the prompt, and can't use it again, clear it
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error("PWA install prompt error:", error);
    }
  }, [deferredPrompt]);

  return { isInstallable, handleInstallClick };
}
