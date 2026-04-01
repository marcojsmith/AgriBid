import path from "path";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

import pkg from "./package.json";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // For Vercel Previews, VERCEL_URL is the dynamic branch URL.
  // We prioritize VITE_CONVEX_SITE_URL if available (set by bunx convex deploy).
  const siteUrl =
    env.VITE_CONVEX_SITE_URL ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:5173");

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "autoUpdate",
        devOptions: { enabled: true, type: "module" },
        includeAssets: ["favicon.ico", "robots.txt", "icons/*.png"],
        manifest: {
          name: env.VITE_APP_NAME || "My App",
          short_name: env.VITE_APP_SHORT_NAME || "My App",
          description: env.VITE_APP_DESCRIPTION || "A web application",
          display: "standalone",
          start_url: "/",
          background_color: "#ffffff",
          theme_color: env.VITE_APP_THEME_COLOR || "#000000",
          icons: [
            {
              src: "/icons/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/icons/icon-512x512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
    define: {
      "process.env.BETTER_AUTH_URL": JSON.stringify(siteUrl),
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
    },
    server: {
      proxy: {
        "/api/auth": {
          target:
            env.VITE_CONVEX_SITE_URL ||
            "https://useful-blackbird-263.convex.site",
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "convex/_generated": path.resolve(__dirname, "./convex/_generated"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-convex": ["convex", "@convex-dev/better-auth"],
            "vendor-auth": ["better-auth"],
            "vendor-ui": [
              "lucide-react",
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-dialog",
              "@radix-ui/react-slot",
              "sonner",
            ],
          },
        },
      },
    },
  };
});
