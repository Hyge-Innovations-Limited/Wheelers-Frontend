import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // What Apple and Google read to let the app use passkeys for this site.
  async rewrites() {
    return [
      { source: "/.well-known/apple-app-site-association", destination: "/api/well-known/apple-app-site-association" },
      { source: "/.well-known/assetlinks.json", destination: "/api/well-known/assetlinks" },
    ];
  },
};

export default nextConfig;
