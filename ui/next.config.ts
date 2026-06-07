import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import type { NextConfig } from "next";
const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const rootEnv = resolve(__dirname, "../.env");
if (existsSync(rootEnv)) {
  loadDotenv({ path: rootEnv });
}

const nextConfig: NextConfig = {
  // Static export only for production builds (container/nginx).
  // Keeping this off in `next dev` avoids corrupted .next manifest errors.
  ...(process.env.NODE_ENV === "production" ? { output: "export" as const } : {}),
  trailingSlash: true,
  devIndicators: false,
  webpack: (config) => {
    if (!useMocks) {
      config.resolve ??= {};
      config.resolve.alias = {
        ...config.resolve.alias,
        "@/lib/mock-api": resolve(__dirname, "src/lib/mock-api-stub.ts"),
      };
    }
    return config;
  },
};

export default nextConfig;
