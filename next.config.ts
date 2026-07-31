import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Lint runs via `npm run lint` (Next 15 has no reliable `next lint` here).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
