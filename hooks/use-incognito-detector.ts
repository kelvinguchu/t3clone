"use client";

import { useState, useEffect } from "react";

// This detection logic is adapted from `detectIncognito.js`
// @see https://github.com/Joe12387/detectIncognito

type BrowserMatcher = {
  browser: "chrome" | "firefox" | "safari" | "edge" | "ie" | "unknown";
  version: number;
};

function getBrowser(): BrowserMatcher {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) {
    return {
      browser: "firefox",
      version: parseInt(ua.match(/Firefox\/([\d.]+)/)?.[1] ?? "0", 10) || 0,
    };
  }
  if (ua.includes("Edge") || ua.includes("Edg/")) {
    return {
      browser: "edge",
      version:
        parseInt(ua.match(/(?:Edge|Edg)\/([\d.]+)/)?.[1] ?? "0", 10) || 0,
    };
  }
  if (ua.includes("Chrome")) {
    return {
      browser: "chrome",
      version: parseInt(ua.match(/Chrome\/([\d.]+)/)?.[1] ?? "0", 10) || 0,
    };
  }
  if (ua.includes("Safari") && !ua.includes("Chrome")) {
    return {
      browser: "safari",
      version: parseInt(ua.match(/Version\/([\d.]+)/)?.[1] ?? "0", 10) || 0,
    };
  }
  if (ua.includes("MSIE") || ua.includes("Trident/")) {
    return { browser: "ie", version: 11 };
  }
  return { browser: "unknown", version: 0 };
}

async function detectIncognito(): Promise<boolean> {
  return new Promise((resolve) => {
    const { browser } = getBrowser();

    const detectionMethods = {
      chrome: async () => {
        if (!navigator.storage) return false;
        try {
          const estimate = await navigator.storage.estimate();
          // Chrome in incognito has a much smaller quota
          return estimate.quota ? estimate.quota < 120000000 : false;
        } catch {
          return true; // Fails in some cases in incognito
        }
      },
      firefox: async () => {
        try {
          const db = indexedDB.open("test");
          db.onerror = () => resolve(true);
          db.onsuccess = () => resolve(false);
        } catch {
          return true;
        }
        return false; // Should be handled by handlers
      },
      safari: async () => {
        try {
          // In Safari private mode, localStorage is available but has a quota of 0.
          // In normal mode, it's blocked by default until user interaction.
          localStorage.setItem("test", "1");
          localStorage.removeItem("test");
        } catch {
          return navigator.cookieEnabled; // If cookies are disabled, it's likely private mode
        }
        return false;
      },
      edge: async () => {
        return !window.indexedDB;
      },
      ie: async () => {
        return !window.indexedDB;
      },
      unknown: async () => false,
    };

    detectionMethods[browser]()
      .then(resolve)
      .catch(() => resolve(true));
  });
}

export function useIncognitoDetector() {
  const [isIncognito, setIsIncognito] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Run only on client side
    if (typeof window !== "undefined") {
      detectIncognito()
        .then((result) => {
          setIsIncognito(result);
          setIsChecking(false);
        })
        .catch(() => {
          setIsIncognito(true); // Assume incognito on error
          setIsChecking(false);
        });
    }
  }, []);

  return { isIncognito, isChecking };
}
