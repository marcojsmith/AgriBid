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
      exclude: ["src/test/**", "src/components/ui/**"],
      thresholds: {
        statements: 60,
        branches: 59,
        functions: 62,
        lines: 61,
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
