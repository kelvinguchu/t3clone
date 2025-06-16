import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        // Additional modules that might cause issues
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
};

export default nextConfig;
