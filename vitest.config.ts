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
        statements: 76,
        branches: 69,
        functions: 68,
        lines: 77,
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
