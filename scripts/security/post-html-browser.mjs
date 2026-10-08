/* global process, URL, URLSearchParams, document, window, console */
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mocks = path.join(root, 'scripts/security/post-html-mocks.jsx');
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const server = await createServer({
  root,
  configFile: false,
  cacheDir: path.join(tmpdir(), `blog187-vite-${process.pid}`),
  plugins: [react()],
  define: { global: 'window' },
  optimizeDeps: { entries: ['scripts/security/post-html.html'], include: ['jwt-decode'] },
  resolve: {
    alias: [
      { find: '@laisky/js-utils', replacement: mocks },
      { find: '../library/base.jsx', replacement: mocks },
      { find: '../components/comments.jsx', replacement: mocks },
    ],
  },
  server: { host: '127.0.0.1', port: 11307, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
  const fixtures = process.argv.includes('--reproduce') ? [
    { mode: 'history', source: 'cache', authorization: 'deny' },
  ] : [
    { mode: 'live', source: 'graphql', authorization: 'allow' },
    { mode: 'live', source: 'cache', authorization: 'allow' },
    { mode: 'history', source: 'graphql', authorization: 'allow' },
    { mode: 'history', source: 'cache', authorization: 'allow' },
    { mode: 'history', source: 'graphql', authorization: 'deny' },
    { mode: 'history', source: 'cache', authorization: 'deny' },
  ];
  for (const fixture of fixtures) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return url.origin === 'http://127.0.0.1:11307' ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:11307/scripts/security/post-html.html?${new URLSearchParams(fixture)}`);
    if (fixture.authorization === 'allow' && !(process.argv.includes('--reproduce') && fixture.mode === 'history' && fixture.source === 'cache')) {
      await page.getByRole('heading', { name: 'Author heading' }).waitFor();
      await page.waitForFunction(() => document.querySelector('.post-content .mermaid svg'));
    }
    if (fixture.authorization === 'deny' && !process.argv.includes('--reproduce')) {
      await page.getByText('This historical article is unavailable.').waitFor();
    }
    await page.waitForTimeout(800);
    const result = await page.evaluate(() => ({
      authored: document.body.dataset.authoredCanary || null,
      foreign: document.body.dataset.foreignCanary || null,
      historyChecks: window.historyChecks || 0,
      article: Boolean(document.querySelector('.post-content')),
      code: Boolean(document.querySelector('.post-content .code-block-container')),
      diagram: Boolean(document.querySelector('.post-content .mermaid svg')),
      series: Boolean(document.querySelector('.post-series-link')),
      image: document.querySelector('.post-content img')?.getAttribute('loading'),
      authoredEmbed: Boolean(document.querySelector('.post-content iframe[title="Authored embed"]')),
      style: document.querySelector('.post-content .slides')?.style.color,
      video: Boolean(document.querySelector('.post-content video[controls]')),
      math: Boolean(document.querySelector('.post-content math mi')),
    }));
    console.log(JSON.stringify({ ...fixture, ...result, errors }));
    if (process.argv.includes('--reproduce') && fixture.mode === 'history' && fixture.source === 'cache') {
      assert.equal(result.foreign, '1');
      assert.equal(result.historyChecks, 0);
    } else if (fixture.authorization === 'deny') {
      assert.equal(result.foreign, null);
      assert.equal(result.authored, null);
      assert.equal(result.article, false);
      assert.equal(result.historyChecks, 1);
      assert.deepEqual(errors, []);
      await page.getByText('This historical article is unavailable.').waitFor();
    } else {
      assert.deepEqual(errors, []);
      assert.equal(result.authored, '1');
      assert.equal(result.foreign, null);
      assert.equal(result.historyChecks, fixture.mode === 'history' ? 1 : 0);
      assert.ok(result.code && result.diagram && result.series && result.authoredEmbed && result.video && result.math);
      assert.equal(result.style, 'blue');
      assert.equal(result.image, 'lazy');
      await page.getByAltText('Safe image').click();
      await page.getByRole('button', { name: 'Close image' }).waitFor();
    }
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
