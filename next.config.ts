import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "playwright", "whoiser"],
};

export default nextConfig;
