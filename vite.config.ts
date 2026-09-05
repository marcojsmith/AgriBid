import path from "path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import pkg from "./package.json";

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
        "@": path.resolve(__dirname, "./src"),
        "convex/_generated": path.resolve(__dirname, "./convex/_generated"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-convex": ["convex"],
            "vendor-clerk": ["@clerk/clerk-react"],
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
