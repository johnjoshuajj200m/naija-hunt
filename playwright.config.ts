import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against a production build that Playwright builds and serves itself with
// `vite preview`, on the port set in vite.config.ts.
const PREVIEW_URL = "http://localhost:4173";

// By default Playwright uses its own bundled Chromium (what CI will use). To reuse a browser that is
// already installed instead of downloading one, set PW_BROWSER_CHANNEL, for example "chrome" or "msedge".
const channel = process.env.PW_BROWSER_CHANNEL || undefined;

export default defineConfig({
  testDir: "e2e",
  // Keep generated output in folders that .gitignore and ESLint already exclude.
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never" }]],
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,

  use: {
    baseURL: PREVIEW_URL,
    trace: "retain-on-failure",
    channel,
  },

  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1100, height: 640 } },
    },
    {
      name: "mobile-chromium",
      // Pixel 7 is a Chromium device profile; the viewport matches the 390x844 phone target.
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],

  // Always a fresh build and a fresh server, so a test can never pass against stale output.
  // Reuse is deliberately off: if something already listens on the port, Playwright stops with an
  // error instead of silently testing it. Stop the other server and run the tests again.
  webServer: {
    command: "npm run build && npm run preview",
    url: PREVIEW_URL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
