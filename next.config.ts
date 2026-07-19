import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "@linear/sdk"],
  outputFileTracingIncludes: {
    // The /personas page reads persona docs from disk at request time.
    "/personas": ["./personas/**/*"],
    "/personas/**": ["./personas/**/*"],
    // The PGlite fallback (deployed demo mode, no DATABASE_URL) reads the
    // migration files at runtime; the Linear routes read config/linear.json.
    // Bundle both into every serverless function.
    "/**": ["./drizzle/**/*", "./config/**/*"],
  },
};

export default nextConfig;
