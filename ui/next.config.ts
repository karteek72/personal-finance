import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export only for production builds (container/nginx).
  // Keeping this off in `next dev` avoids corrupted .next manifest errors.
  ...(process.env.NODE_ENV === "production" ? { output: "export" as const } : {}),
  trailingSlash: true,
  devIndicators: false,
};

export default nextConfig;
