// app/vitest.config.ts
import path from "path";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", ".claude/worktrees/**"],
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
      // `coverage.include` is what makes Vitest measure files that no test
      // imports; the old `all: true` flag was removed in Vitest 4/5.
      include: ["src/**/*.{ts,tsx}", "convex/**/*.ts"],
      reporter: ["text", "json", "html"],
      exclude: [
        "src/test/**",
        "src/components/ui/**",
        "src/main.tsx",
        "node_modules/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        // Global gate. Deliberately set above the 90% floor so small
        // regressions cannot flip the build; re-measure with
        // `bun run test:coverage` before lowering anything here.
        statements: 95,
        branches: 92,
        functions: 95,
        lines: 95,
        // Per-file floors. These used to be set far below what the tests
        // actually achieve and were only lowered to make the gate pass.
        "src/components/admin/FeeManager.tsx": {
          statements: 90,
          branches: 90,
          functions: 95,
          lines: 90,
        },
        "convex/admin/fees.ts": {
          statements: 93,
          branches: 94,
          functions: 68,
          lines: 93,
        },
        "convex/auctions/proxy_bidding.ts": {
          statements: 89,
          branches: 94,
          functions: 69,
          lines: 89,
        },
        "convex/auctions/mutations/adminCrud.ts": {
          statements: 95,
          branches: 85,
          functions: 95,
          lines: 95,
        },
        "convex/auctions/mutations/create.ts": {
          statements: 95,
          branches: 92,
          functions: 95,
          lines: 95,
        },
        "convex/auctions/queries/browse.ts": {
          statements: 93,
          branches: 92,
          functions: 83,
          lines: 93,
        },
        "convex/profileFlags.ts": {
          statements: 95,
          branches: 88,
          functions: 95,
          lines: 95,
        },
        "convex/reviews.ts": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        "src/hooks/useErrorHandler.ts": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        "src/pages/admin/AdminErrorReportingSettings.tsx": {
          statements: 92,
          branches: 92,
          functions: 85,
          lines: 92,
        },
        "src/pages/admin/AdminErrorReports.tsx": {
          statements: 97,
          branches: 90,
          functions: 97,
          lines: 97,
        },

        // Backend: Publish handlers (anonymous handlers in Convex mutations)
        "convex/auctions/mutations/publish.ts": {
          statements: 98,
          branches: 93,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "convex/_generated": path.resolve(
        import.meta.dirname,
        "./convex/_generated"
      ),
    },
  },
});
