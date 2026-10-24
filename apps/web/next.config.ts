import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: [],
  reactStrictMode: true,
  distDir: process.env.REPOREEL_NEXT_DIST_DIR ?? ".next",
  experimental: { workerThreads: process.platform === "win32" },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_URL ?? "http://127.0.0.1:4000"}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};
export default config;
