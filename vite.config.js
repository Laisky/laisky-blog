import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * resolveAliases maps import specifiers for both the app build and Vitest.
 *
 * `@laisky/js-utils` publishes no `exports` map and points its `browser` field at a UMD bundle.
 * Vite 8 follows `resolve.mainFields` strictly (browser before module), so without this alias it
 * bundles the UMD file, whose CommonJS default export drops members such as `KvGet`. Pinning the
 * package's own ESM build keeps the default and named exports that the app imports.
 */
export const resolveAliases = [
  { find: '@', replacement: path.resolve(__dirname, './src') },
  { find: /^@laisky\/js-utils$/, replacement: '@laisky/js-utils/dist/index.esm.js' },
];

export default defineConfig({
  plugins: [react()],
  define: { global: 'window' },
  resolve: {
    alias: resolveAliases,
  },
  css: {
    preprocessorOptions: {
      scss: {
        // additionalData: `@import "src/scss/variables.scss";`
        silenceDeprecations: ['import', 'global-builtin', 'color-functions'],
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
