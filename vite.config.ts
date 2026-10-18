
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'copy-highwaypulse-static-files',
      closeBundle() {
        for (const folder of ['js', 'css', 'templates', 'assets']) {
          if (existsSync(folder)) {
            cpSync(folder, `dist/${folder}`, { recursive: true });
          }
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve('.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
