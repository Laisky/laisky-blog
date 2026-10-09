/* global process, URL, console, window, document */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../../', import.meta.url));
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const server = await createServer({
  root,
  configFile: false,
  cacheDir: path.join(tmpdir(), 'blog188-vite-' + process.pid),
  plugins: [react()],
  define: { global: 'window' },
  optimizeDeps: { entries: ['scripts/security/sso-code.html'], include: ['jwt-decode'] },
  resolve: { alias: [{ find: '@laisky/js-utils', replacement: path.join(root, 'scripts/security/sso-code-mocks.jsx') }] },
  server: { host: '127.0.0.1', port: 11308, strictPort: true, hmr: false },
});
const code = 'A'.repeat(43);
const state = 'B'.repeat(42) + 'A';
const verifier = 'C'.repeat(42) + 'A';
const challenge = createHash('sha256').update(verifier).digest('base64url');
const token =
  Buffer.from('{"alg":"none"}').toString('base64url') +
  '.' +
  Buffer.from(JSON.stringify({ sub: 'local-only', exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url') +
  '.local-only';
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
  for (const mode of ['fresh', 'replay', 'wrong-state', 'expired', 'legacy', 'storage-failure', 'interrupted']) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    let exchanges = 0;
    let telemetry = 0;
    const requests = [];
    const errors = [];
    await context.addInitScript(
      ({ mode, state, verifier }) => {
        window.fixtureMode = mode;
        const query = new URL(window.location.href).searchParams;
        if (query.has('sso_code') || query.has('sso_token')) {
          window.sessionStorage.setItem(
            'sso_code_transaction',
            JSON.stringify({
              state: mode === 'wrong-state' ? 'D'.repeat(42) + 'A' : state,
              verifier,
              createdAt: Date.now() - (mode === 'expired' ? 601000 : 0),
              redirectPath: '/?done=1#intro',
            })
          );
          window.sessionStorage.setItem('fixture:auth_user', JSON.stringify({ sub: 'previous-local' }));
          window.sessionStorage.setItem('fixture:user_token', JSON.stringify('existing-local-token'));
        }
      },
      { mode, state, verifier }
    );
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = request.headers();
      requests.push({ url: url.toString(), referer: headers.referer || '' });
      assert.equal(headers.referer || '', '', 'No callback referrer may leave the document: ' + url.pathname);
      if (url.href === 'https://sso.laisky.com/sso/token') {
        if (request.method() === 'OPTIONS')
          return route.fulfill({
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': 'https://blog.laisky.com',
              'Access-Control-Allow-Methods': 'POST',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          });
        exchanges++;
        assert.equal(request.method(), 'POST');
        const body = request.postDataJSON();
        assert.equal(body.client_id, 'blog');
        assert.equal(body.redirect_uri, 'https://blog.laisky.com');
        assert.equal(body.code, code);
        assert.equal(body.state, state);
        assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), challenge);
        if (mode === 'interrupted') return route.abort();
        if (mode === 'replay')
          return route.fulfill({
            status: 400,
            contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': 'https://blog.laisky.com' },
            body: '{"error":"invalid_grant"}',
          });
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': 'https://blog.laisky.com' },
          body: JSON.stringify({ access_token: token, token_type: 'Bearer', expires_in: 300 }),
        });
      }
      if (url.origin === 'https://js.sentry-cdn.com') {
        telemetry++;
        // Read frame metadata synchronously; successful callbacks replace the document.
        const documentURL = new URL(request.frame().url());
        assert.equal(documentURL.origin, 'https://blog.laisky.com');
        assert.equal(documentURL.searchParams.has('sso_code'), false);
        assert.equal(documentURL.searchParams.has('sso_token'), false);
        if (mode === 'fresh') assert.equal(exchanges, 1);
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* local optional SDK fixture */' });
      }
      if (url.origin !== 'https://blog.laisky.com') return route.abort();
      const fixturePath = url.pathname === '/' ? '/scripts/security/sso-code.html' : url.pathname;
      // Serve the fixture document verbatim: Vite dev HTML inserts its client before the meta policy.
      // Application modules still use the local transform server; no request or referrer is exempted.
      if (url.pathname === '/')
        return route.fulfill({
          contentType: 'text/html',
          headers: { 'Cache-Control': 'no-store' },
          body: await readFile(path.join(root, 'scripts/security/sso-code.html')),
        });
      // Route fulfillment uses only the local Vite server; canonical DNS and issuer are never contacted.
      const response = await globalThis.fetch('http://127.0.0.1:11308' + fixturePath + (url.pathname === '/' ? '' : url.search));
      return route.fulfill({
        status: response.status,
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        headers: { 'Cache-Control': 'no-store' },
        body: Buffer.from(await response.arrayBuffer()),
      });
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    const query = mode === 'legacy' ? '?sso_token=LOCAL_ONLY_CANARY' : '?sso_code=' + code + '&sso_state=' + state;
    await page.goto('https://blog.laisky.com/' + query);
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    if (mode === 'fresh') await page.waitForURL('https://blog.laisky.com/?done=1#intro');
    await page.waitForTimeout(150);
    const result = await page.evaluate(() => ({
      outcome: window.fixtureOutcome,
      token: JSON.parse(window.sessionStorage.getItem('fixture:user_token')),
      user: JSON.parse(window.sessionStorage.getItem('fixture:auth_user')),
      query: window.location.search,
      transaction: window.sessionStorage.getItem('sso_code_transaction'),
    }));
    assert.equal(result.transaction, null);
    assert.equal(/sso_(?:token|code|state)/.test(result.query), false);
    assert.deepEqual(errors, []);
    if (mode === 'fresh') {
      assert.equal(result.token, token);
      assert.equal(result.user.sub, 'local-only');
      assert.equal(exchanges, 1);
    } else {
      assert.equal(result.outcome, 'rejected');
      assert.equal(result.token, 'existing-local-token');
      assert.equal(result.user.sub, 'previous-local');
      assert.equal(exchanges, ['replay', 'storage-failure', 'interrupted'].includes(mode) ? 1 : 0);
    }
    assert.ok(telemetry > 0);
    for (const request of requests) {
      assert.equal(request.url.includes(token), false);
      assert.equal(request.url.includes(verifier), false);
      if (mode !== 'legacy') assert.equal(request.url.includes('sso_token='), false);
    }
    console.log(JSON.stringify({ mode, passed: true, exchanges, telemetry, noBearerInURLs: true, noReferrers: true }));
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
