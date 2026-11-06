import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bin will host this under vedalken.dev/plancheck.
  // Leave basePath unset so `/` and `/plancheck` both work in this MVP repo.
  serverExternalPackages: ["tesseract.js", "@napi-rs/canvas"],
  turbopack: {
    resolveAlias: {
      "@napi-rs/canvas": {
        browser: "./src/lib/pdf/canvas-stub.ts",
      },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@napi-rs/canvas": false,
      };
    }
    return config;
  },
};

export default nextConfig;
