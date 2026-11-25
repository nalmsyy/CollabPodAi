import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@solid/access-token-verifier"],
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
