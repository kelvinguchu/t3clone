import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.ufs.sh",
        pathname: "/f/*",
      },
    ],
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60, // Cache images for 1 minute minimum
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  webpack: (config, { isServer, nextRuntime }) => {
    // Only apply these fallbacks for browser bundles (not server-side)
    if (!isServer && typeof nextRuntime === "undefined") {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Node.js core modules that don't exist in browser
        fs: false,
        net: false,
        tls: false,
        dns: false,
        http2: false,
        child_process: false,
        readline: false,
        inspector: false,
        async_hooks: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        querystring: false,
        path: false,
        os: false,
      };

      // Mark server-only packages as external for browser builds
      config.externals = config.externals || [];
      config.externals.push({
        // Playwright and related packages
        "playwright-core": "commonjs playwright-core",
        "@browserbasehq/sdk": "commonjs @browserbasehq/sdk",
        // JSDOM and related packages
        jsdom: "commonjs jsdom",
        "@mozilla/readability": "commonjs @mozilla/readability",
        // Resumable streams and Redis (server-only)
        "resumable-stream": "commonjs resumable-stream",
        redis: "commonjs redis",
        // Other potentially problematic packages
        "node-gyp-build": "commonjs node-gyp-build",
        bufferutil: "commonjs bufferutil",
        "utf-8-validate": "commonjs utf-8-validate",
      });
    }

    return config;
  },
  env: {
    // Ensure Clerk redirect URLs are properly configured
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/chat",
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/chat",
  },
};

export default nextConfig;
