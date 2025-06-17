import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher(["/server"]);

// Define public routes that should be accessible without authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/share/(.*)", // All share routes are public
  "/auth/callback/(.*)", // Authentication callback routes must be public
]);

// Define share-specific routes for additional handling if needed
const isShareRoute = createRouteMatcher(["/share/(.*)"]);

// Define auth callback routes for special handling
const isAuthCallbackRoute = createRouteMatcher(["/auth/callback/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public access to auth callback routes (critical for OAuth flow)
  if (isAuthCallbackRoute(req)) {
    // Auth callback routes must be public to complete OAuth flow
    // This is essential for Clerk's OAuth redirect flow to work properly
    return;
  }

  // Allow public access to share routes
  if (isShareRoute(req)) {
    // Share routes are always public - no auth required
    return;
  }

  // Handle other public routes
  if (isPublicRoute(req)) {
    // Public routes don't require auth
    return;
  }

  // For protected routes, require authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
    return;
  }

  // Default behavior: protect all other routes
  // This ensures that new routes are secure by default
  await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
