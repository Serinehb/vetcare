import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  devIndicators: false,
  allowedDevOrigins: [
    "preview-chat-3e98fc47-b9ab-485c-8421-d145c7120c69.space-z.ai",
  ],
};

export default nextConfig;
