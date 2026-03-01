import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 uses Turbopack by default; an empty config prevents the
  // "webpack config with no turbopack config" build error on Vercel.
  turbopack: {},
};

export default nextConfig;
