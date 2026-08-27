import type { NextConfig } from "next";

const djangoApiOrigin = (
  process.env.DJANGO_API_ORIGIN ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${djangoApiOrigin}/api/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
