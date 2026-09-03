import type { NextConfig } from "next";

import { getBackendApiOrigin } from "./config/api/server";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${getBackendApiOrigin()}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
