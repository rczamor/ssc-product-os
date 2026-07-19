import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    // The /personas page reads persona docs from disk at request time.
    "/personas": ["./personas/**/*"],
    "/personas/**": ["./personas/**/*"],
    // The PGlite fallback (deployed demo mode, no DATABASE_URL) reads the
    // migration files at runtime — bundle them into every serverless function
    // or getDb() throws "cannot find meta/_journal.json" after deploy.
    "/**": ["./drizzle/**/*"],
  },
};

export default nextConfig;
