// This is a custom service worker script that will be injected into the generated service worker

// Custom cache name for our app
const CACHE_NAME = "t3chat-v1";

// Add custom fetch handler for specific routes
self.addEventListener("fetch", (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // For navigation requests (HTML pages), try the network first, then fall back to cache
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match("/offline.html") || caches.match(event.request);
      }),
    );
    return;
  }

  // For image requests, try the cache first, then fall back to network
  if (event.request.destination === "image") {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return (
          cachedResponse ||
          fetch(event.request)
            .then((response) => {
              // Clone the response to cache it and return it
              const clonedResponse = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clonedResponse);
              });
              return response;
            })
            .catch(() => {
              // If both cache and network fail, return a fallback image
              return (
                caches.match("/icon512_rounded.png") ||
                fetch("/icon512_rounded.png")
              );
            })
        );
      }),
    );
    return;
  }
});

// Add event listener for handling app installation
self.addEventListener("install", (event) => {
  // Pre-cache important assets
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "/",
        "/chat",
        "/offline.html",
        "/logo.svg",
        "/icon512_maskable.png",
        "/icon512_rounded.png",
        "/manifest.json",
      ]);
    }),
  );
});

// Clean up old caches when a new service worker is activated
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
    }),
  );
});
