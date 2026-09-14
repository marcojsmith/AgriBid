import path from "path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import pkg from "./package.json" with { type: "json" };

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
    },
    server: {
      host: true,
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
