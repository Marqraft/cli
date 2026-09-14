import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'assets', emptyOutDir: true,
    lib: { entry: 'frontend/src/main.tsx', formats: ['iife'], name: 'Marqraft', fileName: () => 'editor.js', cssFileName: 'marqraft-author' },
    cssCodeSplit: false,
  },
});
