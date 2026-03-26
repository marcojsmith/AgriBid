// app/vitest.config.ts
import path from "path";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      ALLOW_PII_DEV_FALLBACK: "true",
      CONVEX_SITE_URL: "http://localhost:3000",
      PII_ENCRYPTION_KEY: "12345678901234567890123456789012",
    },
    typecheck: {
      tsconfig: "./tsconfig.vitest.json",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "src/test/**",
        "src/components/ui/**",
        "node_modules/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        // Global Baseline - Updated March 2026 after test coverage improvements
        statements: 95,
        branches: 92,
        functions: 94,
        lines: 95,

        // Issue 59: Error Reporting
        "src/lib/error-reporter.ts": {
          statements: 65,
          branches: 60,
          functions: 50,
          lines: 65,
        },
        "src/hooks/useErrorHandler.ts": {
          statements: 80,
          branches: 60,
          functions: 80,
          lines: 80,
        },
        "src/pages/admin/AdminErrorReportingSettings.tsx": {
          statements: 90,
          branches: 75,
          functions: 80,
          lines: 90,
        },
        "src/pages/admin/AdminErrorReports.tsx": {
          statements: 95,
          branches: 80,
          functions: 90,
          lines: 95,
        },

        // Backend: Publish handlers (anonymous handlers in Convex mutations)
        "convex/auctions/mutations/publish.ts": {
          statements: 98,
          branches: 93,
          functions: 100,
          lines: 100,
        },

        // Frontend: App lazy-loaded routes
        "src/App.tsx": {
          statements: 96,
          branches: 100,
          functions: 92,
          lines: 100,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "convex/_generated": path.resolve(__dirname, "./convex/_generated"),
    },
  },
});
