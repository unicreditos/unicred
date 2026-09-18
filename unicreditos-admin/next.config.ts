import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Evita que Turbopack tome el monorepo padre (proxy.ts / lockfiles).
  turbopack: {
    root,
  },
};

export default nextConfig;
