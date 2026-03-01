import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer }) {
    if (isServer) {
      // Native Node.js addons cannot be bundled by webpack.
      // Mark them as external so they're required at runtime instead.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "better-sqlite3",
        "officeparser",
      ];
    }
    return config;
  },
};

export default nextConfig;
