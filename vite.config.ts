import fs from "node:fs";
import path from "path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import pkg from "./package.json" with { type: "json" };

// TLS cert issued by `tailscale cert` for the MagicDNS name of this machine.
// Enables a trusted HTTPS dev server reachable from any device on the tailnet,
// and a secure browser context (required by Clerk's dev-browser handshake).
const certDir = path.resolve(import.meta.dirname, "./certs");
const certName = "trio5700x.taila18a1c.ts.net";
const keyPath = path.join(certDir, `${certName}.key`);
const certPath = path.join(certDir, `${certName}.crt`);

const https =
  fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
    : undefined;

export default defineConfig(() => {
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
