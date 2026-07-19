import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/personas": ["./personas/**/*"],
    "/personas/**": ["./personas/**/*"],
  },
};

export default nextConfig;
