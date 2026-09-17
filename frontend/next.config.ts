import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root explicitly: the user's home directory (outside this
  // git repo) has a stray package-lock.json that would otherwise confuse
  // Turbopack's root inference.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
