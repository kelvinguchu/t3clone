import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "./core";

// Force Node.js runtime for better development server compatibility
// This prevents edge runtime limitations that can cause callback failures
export const runtime = "nodejs";

// Export routes for Next App Router
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,

  config: {
    token: process.env.UPLOADTHING_TOKEN,
    isDev: process.env.NODE_ENV === "development",
    // Enhance development callback handling
    logLevel: process.env.NODE_ENV === "development" ? "Debug" : "Info",
    // Ensure proper callback URL detection
    callbackUrl:
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000/api/uploadthing"
        : undefined, // Let UploadThing auto-detect in production
  },
});
