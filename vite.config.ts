// Imported from "vitest/config" (not "vite") so the `test` block below is typed.
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Fixed port so Playwright and CI always know where the production build is served.
  preview: {
    port: 4173,
    strictPort: true,
  },

  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Unit tests live beside the source. Playwright specs in e2e/ are excluded on purpose.
    include: ["src/**/*.test.{ts,tsx}"],
    // Tests import describe/it/expect explicitly instead of using globals.
    globals: false,
  },
});
