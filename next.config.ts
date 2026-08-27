import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables `scripts/installer/build-installer.ps1` to ship a minimal,
  // self-contained `.next/standalone` server (traced node_modules subset)
  // instead of requiring `npm install` on the target host.
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "playwright", "whoiser"],
};

export default nextConfig;
