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
        // Global Baseline
        statements: 89,
        branches: 81,
        functions: 82,
        lines: 90,

        // Security-critical: RoleProtectedRoute
        "src/components/RoleProtectedRoute.tsx": {
          statements: 100,
          branches: 94,
          functions: 100,
          lines: 100,
        },

        // Security-critical: Authentication Client
        "src/lib/auth-client.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },

        // Data-critical: Bidding Panel Logic
        "src/components/bidding/BiddingPanel.tsx": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },

        // Backend-critical: Core Bidding Logic
        "convex/auctions/bidding.ts": {
          statements: 95,
          branches: 95,
          functions: 100,
          lines: 95,
        },

        // Data-critical: File Storage Handling
        "src/hooks/useFileUpload.ts": {
          statements: 95,
          branches: 90,
          functions: 100,
          lines: 95,
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
