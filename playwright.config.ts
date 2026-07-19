import { defineConfig } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/login`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      USE_PGLITE: "1",
      // Defined-but-empty so a developer's .env.local (persistent
      // PGLITE_DATA_DIR) can't leak into the e2e server — tests always run
      // against fresh in-memory, seeded data.
      PGLITE_DATA_DIR: "",
      PGLITE_SEED: "1",
      ADMIN_PASSWORD: "test-password",
      SESSION_SECRET: "test-session-secret",
    },
  },
});
