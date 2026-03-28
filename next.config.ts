import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    process.env.REPLIT_DEV_DOMAIN ?? "",
  ].filter(Boolean),
  serverExternalPackages: ["pg", "postgres", "busboy"],
};

export default nextConfig;
