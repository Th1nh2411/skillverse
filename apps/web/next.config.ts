import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@skillverse/api", "@skillverse/domain", "@skillverse/validation", "@skillverse/db"],
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  typedRoutes: false,
  poweredByHeader: false,
};

export default nextConfig;
