import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: {
      USE_PGLITE: "1",
      // Defined-but-empty so runner loadEnv() cannot pull a persistent
      // PGLITE_DATA_DIR from a developer's .env.local into tests.
      PGLITE_DATA_DIR: "",
      SESSION_SECRET: "test-session-secret",
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_PASSWORD: "test-password",
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
