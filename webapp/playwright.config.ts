import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Exclude the screenshot-capture script from normal test runs
  // Run separately: npx playwright test e2e/capture-screenshots.spec.ts
  testIgnore: ["**/capture-screenshots.spec.ts"],
  // Run tests serially to avoid Firestore state conflicts
  fullyParallel: false,
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Give Firebase real-time updates time to propagate
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Starts Vite dev server (DEV=true → emulators + __e2eSignIn helper available)
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
