import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The app lives inside a larger portfolio repository; pin the workspace root here.
  turbopack: { root: __dirname },
};

export default nextConfig;
