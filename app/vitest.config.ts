// app/vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "convex/_generated": path.resolve(__dirname, "./convex/_generated"),
    },
  },
});
