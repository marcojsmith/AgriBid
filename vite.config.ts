import fs from "node:fs";
import path from "path";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import pkg from "./package.json" with { type: "json" };

export default defineConfig(({ mode }) => {
  // TLS cert issued by `tailscale cert` for this machine's MagicDNS name.
  // Enables a trusted HTTPS dev server reachable from any device on the
  // tailnet, and a secure browser context (required by Clerk's dev-browser
  // handshake). Set TAILSCALE_CERT_NAME in .env.local to your own machine's
  // name (see .env.example) — each developer's tailnet name differs.
  const env = loadEnv(mode, process.cwd(), "");
  const certDir = path.resolve(import.meta.dirname, "./certs");
  const certName = env.TAILSCALE_CERT_NAME ?? "trio5700x.taila18a1c.ts.net";
  const keyPath = path.join(certDir, `${certName}.key`);
  const certPath = path.join(certDir, `${certName}.crt`);

  /* eslint-disable security/detect-non-literal-fs-filename -- certName comes from the local developer's own .env.local, not external input */
  const https =
    fs.existsSync(keyPath) && fs.existsSync(certPath)
      ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
      : undefined;
  /* eslint-enable security/detect-non-literal-fs-filename */

  return {
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
    },
    server: {
      host: true,
      https,
      proxy: {},
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
    build: {
      rollupOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "vendor-react",
                test: /node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
              },
              {
                name: "vendor-convex",
                test: /node_modules[\\/]convex[\\/]/,
              },
              {
                name: "vendor-clerk",
                test: /node_modules[\\/]@clerk[\\/]clerk-react[\\/]/,
              },
              {
                name: "vendor-ui",
                test: /node_modules[\\/](lucide-react|@radix-ui[\\/]react-accordion|@radix-ui[\\/]react-alert-dialog|@radix-ui[\\/]react-dialog|@radix-ui[\\/]react-slot|sonner)[\\/]/,
              },
            ],
          },
        },
      },
    },
  };
});
