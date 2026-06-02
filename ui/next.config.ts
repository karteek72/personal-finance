import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Hide the Next.js "N" dev badge (still appears when there is a build/runtime error).
  devIndicators: false,
};

export default nextConfig;
