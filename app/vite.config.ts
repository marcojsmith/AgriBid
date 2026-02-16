import path from "path"
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // For Vercel Previews, VERCEL_URL is the dynamic branch URL.
  // We prioritize VITE_CONVEX_SITE_URL if available (set by npx convex deploy).
  const siteUrl = env.VITE_CONVEX_SITE_URL || 
                 (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:5173');

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'process.env.BETTER_AUTH_URL': JSON.stringify(siteUrl),
    },
    server: {
      proxy: {
        '/api/auth': {
          target: env.VITE_CONVEX_SITE_URL || 'https://useful-blackbird-263.convex.site',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'convex/_generated': path.resolve(__dirname, './convex/_generated'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-convex': ['convex', '@convex-dev/better-auth'],
            'vendor-auth': ['better-auth'],
            'vendor-ui': [
              'lucide-react', 
              '@radix-ui/react-accordion',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-dialog',
              '@radix-ui/react-slot',
              'sonner'
            ],
          },
        },
      },
    },
  }
})
