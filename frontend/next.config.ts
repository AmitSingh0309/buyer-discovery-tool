import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Proxy /api/* calls to the Python FastAPI backend during SSR and in API routes.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
  // Expose the backend URL to server components only (not leaked to the browser).
  env: {
    BACKEND_URL,
  },
};

export default nextConfig;