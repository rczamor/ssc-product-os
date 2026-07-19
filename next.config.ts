import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "@linear/sdk"],
  outputFileTracingIncludes: {
    // The home page and /personas both read persona docs from disk at request
    // time (loadPersonas → personas/<slug>/persona.md). Trace personas/ for the
    // root route explicitly — the "/**" glob does not cover "/".
    "/": ["./drizzle/**/*", "./config/**/*", "./personas/**/*"],
    "/personas": ["./personas/**/*"],
    "/personas/**": ["./personas/**/*"],
    // Every serverless function may hit the DB (migration files for the PGlite
    // fallback + Neon auto-migrate) and the Linear routes read config/linear.json.
    // Persona docs are also bundled so any route calling loadPersonas works.
    "/**": ["./drizzle/**/*", "./config/**/*", "./personas/**/*"],
  },
};

export default nextConfig;
