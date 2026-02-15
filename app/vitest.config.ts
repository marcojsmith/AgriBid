// app/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'convex/_generated/api': path.resolve(__dirname, './src/test/mocks/convex-api.ts'),
      'convex/_generated/dataModel': path.resolve(__dirname, './src/test/mocks/convex-dataModel.ts'),
    },
  },
});