import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  define: { global: 'window' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // additionalData: `@import "src/scss/variables.scss";`
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'mixed-decls'],
      },
    },
  },
  server: {
    port: 3000,
    watch: {
      // usePolling: true,
      interval: 1000,
      additionalPaths: (watcher) => {
        watcher.add('./src/scss/**');
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
});
