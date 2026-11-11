import type { NextConfig } from "next";
import { securityHeaders } from "./lib/server/security-headers";

const nextConfig: NextConfig = {
  // Cho phép nhiều dev server song song (ui / qa) mà không tranh thư mục build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@skillverse/api", "@skillverse/domain", "@skillverse/validation", "@skillverse/db"],
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  typedRoutes: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders() }];
  },
};

export default nextConfig;
