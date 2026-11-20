import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@morsehq-dev/sdk"],
  allowedDevOrigins: [
    "*.run.app",
    "ais-dev-6ysvfyu2dq4yjqkmzpujww-190522824735.asia-southeast1.run.app",
    "ais-pre-6ysvfyu2dq4yjqkmzpujww-190522824735.asia-southeast1.run.app",
  ],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
