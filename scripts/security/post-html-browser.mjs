/* global process, URL, document, console */
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mocks = path.join(root, 'scripts/security/post-html-mocks.jsx');
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const server = await createServer({
  root,
  configFile: false,
  plugins: [react()],
  define: { global: 'window' },
  optimizeDeps: { entries: ['scripts/security/post-html.html'] },
  resolve: {
    alias: [
      { find: '@laisky/js-utils', replacement: mocks },
      { find: '../library/base.jsx', replacement: mocks },
      { find: '../components/comments.jsx', replacement: mocks },
    ],
  },
  server: { host: '127.0.0.1', port: 11307, strictPort: true },
});
server.middlewares.use('/local-canary.js', (_request, response) => {
  response.setHeader('Content-Type', 'text/javascript');
  response.end("document.body.dataset.asyncCanary = '1';");
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
  for (const mode of ['live', 'history']) {
    for (const source of ['graphql', 'cache']) {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        return url.origin === 'http://127.0.0.1:11307' ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:11307/scripts/security/post-html.html?mode=${mode}&source=${source}`);
      await page.getByRole('heading', { name: 'Safe heading' }).waitFor();
      await page.waitForTimeout(500);
      const result = await page.evaluate(() => ({
        srcdoc: document.body.dataset.srcdocCanary || null,
        asyncScript: document.body.dataset.asyncCanary || null,
        activeNodes: document.querySelectorAll('.post-content iframe,script[src="/local-canary.js"]').length,
        code: Boolean(document.querySelector('.post-content .code-block-container')),
        diagram: Boolean(document.querySelector('.post-content .mermaid svg')),
        series: Boolean(document.querySelector('.post-series-link')),
        image: document.querySelector('.post-content img')?.getAttribute('loading'),
      }));
      console.log(JSON.stringify({ mode, source, ...result }));
      if (process.argv.includes('--reproduce')) {
        assert.equal(result.srcdoc, '1');
      } else {
        assert.equal(result.srcdoc, null);
        assert.equal(result.asyncScript, null);
        assert.equal(result.activeNodes, 0);
        assert.ok(result.code);
        assert.ok(result.diagram);
        assert.ok(result.series);
        assert.equal(result.image, 'lazy');
        await page.getByAltText('Safe image').click();
        await page.getByRole('button', { name: 'Close image' }).waitFor();
      }
      await context.close();
    }
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
