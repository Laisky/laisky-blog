/* global process, URL, console, window */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const token =
  Buffer.from('{"alg":"none"}').toString('base64url') +
  '.' +
  Buffer.from(JSON.stringify({ display_name: 'Local SSO Fixture', exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url') +
  '.local-only';

/**
 * assetType returns a content type for a local build asset.
 *
 * @param {string} filename - The asset filename.
 * @returns {string} The response content type.
 */
const assetType = (filename) => {
  if (filename.endsWith('.js')) return 'application/javascript';
  if (filename.endsWith('.css')) return 'text/css';
  if (filename.endsWith('.html')) return 'text/html';
  if (filename.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
try {
  for (const mode of [
    'fresh',
    'bootstrap',
    'bootstrap-mcp',
    'bootstrap-unsafe',
    'bootstrap-history-failure',
    'legacy',
    'legacy-alias',
    'legacy-hash',
    'mixed-hash',
    'wrong-state',
    'expired',
    'interrupted',
    'history-failure',
  ]) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const code = randomBytes(32).toString('base64url');
    let binding;
    let exchanges = 0;
    let taintedCallbackStarted = false;
    const requests = [];
    const errors = [];
    await context.addInitScript((mode) => {
      if (
        (mode === 'history-failure' && new URL(window.location.href).searchParams.has('sso_code')) ||
        (mode === 'bootstrap-history-failure' && new URL(window.location.href).searchParams.has('sso_start'))
      ) {
        window.history.replaceState = () => {
          throw new Error('Local fixture history failure');
        };
      }
      if (mode === 'expired' && new URL(window.location.href).searchParams.has('sso_code')) {
        const transaction = JSON.parse(window.sessionStorage.getItem('sso_code_transaction'));
        transaction.createdAt = Date.now() - 601000;
        window.sessionStorage.setItem('sso_code_transaction', JSON.stringify(transaction));
      }
    }, mode);
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const referer = request.headers().referer || '';
      requests.push({ url: url.toString(), referer, taintedCallbackStarted });
      assert.equal(referer, '', 'Callback and code-exchange referrers must be absent');
      assert.equal(url.toString().includes(token), false);
      if (url.origin === 'https://sso.laisky.com' || url.origin === 'https://mcp.laisky.com') {
        const loginOrigin = mode === 'bootstrap-mcp' ? 'https://mcp.laisky.com' : 'https://sso.laisky.com';
        const loginPath = mode === 'bootstrap-mcp' ? '/sso/login' : '/';
        if (url.origin === loginOrigin && url.pathname === loginPath && request.method() === 'GET') {
          binding = new URL(url.searchParams.get('redirect_to'));
          assert.equal(binding.origin, 'https://blog.laisky.com');
          assert.equal(binding.pathname, '/');
          assert.equal(binding.searchParams.get('sso_flow'), 'code');
          assert.equal(binding.searchParams.get('sso_challenge_method'), 'S256');
          assert.ok(/^[A-Za-z0-9_-]{43}$/.test(binding.searchParams.get('sso_state')));
          assert.equal(binding.searchParams.has('sso_token'), false);
          assert.equal(binding.searchParams.has('code_verifier'), false);
          return route.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Local issuer fixture</p>' });
        }
        assert.equal(url.href, 'https://sso.laisky.com/sso/token');
        if (request.method() === 'OPTIONS')
          return route.fulfill({
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': 'https://blog.laisky.com',
              'Access-Control-Allow-Methods': 'POST',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          });
        assert.equal(request.method(), 'POST');
        exchanges++;
        const body = request.postDataJSON();
        assert.equal(body.client_id, 'blog');
        assert.equal(body.redirect_uri, 'https://blog.laisky.com');
        assert.equal(body.code, code);
        assert.equal(body.state, binding.searchParams.get('sso_state'));
        assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), binding.searchParams.get('sso_challenge'));
        for (const entry of requests) assert.equal(entry.url.includes(body.code_verifier), false);
        if (mode === 'interrupted') return route.abort();
        assert.equal(exchanges, 1, 'The fixture issuer permits one exchange');
        return route.fulfill({
          contentType: 'application/json',
          headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': 'https://blog.laisky.com' },
          body: JSON.stringify({ access_token: token, token_type: 'Bearer', expires_in: 300 }),
        });
      }
      if (url.origin === 'https://gq_v2.laisky.com') {
        if (request.method() === 'OPTIONS')
          return route.fulfill({
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': 'https://blog.laisky.com',
              'Access-Control-Allow-Methods': 'GET',
              'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
            },
          });
        assert.equal(request.method(), 'GET', 'No content mutation is allowed in the offline fixture');
        return route.fulfill({
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': 'https://blog.laisky.com' },
          body: JSON.stringify({ data: { BlogPosts: [], BlogPostInfo: { total: 0 }, BlogPostCategories: [], BlogTags: [] } }),
        });
      }
      // Only inert SDK fixtures are fulfilled; no third-party script or service is contacted.
      if (['https://js.sentry-cdn.com', 'https://www.googletagmanager.com', 'https://cse.google.com'].includes(url.origin)) {
        const documentURL = new URL(request.frame().url());
        assert.equal(documentURL.origin, 'https://blog.laisky.com');
        assert.equal(
          /sso_(?:token|code|state|flow|challenge|verifier|start|return|issuer)|code_verifier/i.test(documentURL.search + documentURL.hash),
          false
        );
        return route.fulfill({
          contentType: 'application/javascript',
          headers: { 'Access-Control-Allow-Origin': 'https://blog.laisky.com' },
          body: '/* inert local SDK fixture */',
        });
      }
      // Fonts, embeds, and all other external requests are blocked.
      if (url.origin !== 'https://blog.laisky.com') return route.abort();
      const relative = url.pathname.startsWith('/assets/') ? url.pathname.slice(1) : 'index.html';
      const filename = path.resolve(dist, relative);
      assert.ok(filename.startsWith(dist), 'Only the isolated build may be served');
      return route.fulfill({
        contentType: assetType(filename),
        headers: { 'Cache-Control': 'no-store' },
        body: await readFile(filename),
      });
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    if (mode === 'legacy-hash') {
      await page.goto('https://blog.laisky.com/#SSO_TOKEN=LOCAL_ONLY_BEARER_CANARY');
    } else if (mode === 'legacy' || mode === 'legacy-alias') {
      await page.goto('https://blog.laisky.com/?' + (mode === 'legacy-alias' ? 'SSO_TOKEN' : 'sso_token') + '=LOCAL_ONLY_BEARER_CANARY');
    } else if (mode === 'bootstrap-unsafe') {
      await page.goto('https://blog.laisky.com/?sso_start=1&sso_return=' + encodeURIComponent('//other.invalid/'));
    } else if (mode === 'bootstrap-history-failure') {
      taintedCallbackStarted = true;
      await page.goto('https://blog.laisky.com/?sso_start=1&sso_return=' + encodeURIComponent('/pages/0/'));
    } else {
      if (mode === 'bootstrap' || mode === 'bootstrap-mcp') {
        await page.goto(
          'https://blog.laisky.com/?sso_start=1&sso_return=' +
            encodeURIComponent('/pages/0/?view=compact#intro') +
            (mode === 'bootstrap-mcp' ? '&sso_issuer=mcp' : '')
        );
      } else {
        await page.goto('https://blog.laisky.com/pages/0/?view=compact#intro');
        await page.getByRole('button', { name: 'Login', exact: true }).click();
      }
      await page.waitForURL((url) => url.origin === (mode === 'bootstrap-mcp' ? 'https://mcp.laisky.com' : 'https://sso.laisky.com'));
      if (mode === 'bootstrap' || mode === 'bootstrap-mcp') {
        assert.equal(
          requests.some((entry) =>
            ['https://js.sentry-cdn.com', 'https://www.googletagmanager.com', 'https://cse.google.com'].includes(new URL(entry.url).origin)
          ),
          false,
          'Bootstrap must not initialize optional SDKs before navigation'
        );
      }
      const state = mode === 'wrong-state' ? randomBytes(32).toString('base64url') : binding.searchParams.get('sso_state');
      await page.goto(
        'https://blog.laisky.com/?sso_code=' +
          code +
          '&sso_state=' +
          state +
          (mode === 'mixed-hash' ? '#SSO_TOKEN=LOCAL_ONLY_BEARER_CANARY' : '')
      );
    }
    if (mode === 'fresh' || mode === 'bootstrap' || mode === 'bootstrap-mcp') {
      await page.waitForURL('https://blog.laisky.com/pages/0/?view=compact#intro');
      await page.getByText('Welcome, Local SSO Fixture').waitFor();
      assert.equal(exchanges, 1);
    } else if (mode === 'history-failure' || mode === 'bootstrap-history-failure') {
      await page.getByRole('alert').filter({ hasText: 'Sign-in could not be completed' }).waitFor();
      await page.getByRole('link', { name: 'Continue to articles' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Login', exact: true }).count(), 0);
      assert.equal(exchanges, 0);
      const callbackRequests = requests.filter((entry) => entry.url.startsWith('https://sso.laisky.com/sso/token'));
      assert.equal(callbackRequests.length, 0);
    } else {
      await page.getByRole('alert').filter({ hasText: 'Sign-in could not be completed' }).waitFor();
      await page.getByRole('button', { name: 'Login', exact: true }).waitFor();
      assert.equal(exchanges, mode === 'interrupted' ? 1 : 0);
    }
    if (mode === 'history-failure' || mode === 'bootstrap-history-failure') {
      // The failed history API cannot clean the URL; the local-only UI must instead prevent App/SDK initialization.
      const marker = mode === 'bootstrap-history-failure' ? 'sso_start' : 'sso_code';
      assert.equal(new URL(page.url()).searchParams.has(marker), true);
      assert.equal(
        requests.some(
          (entry) =>
            entry.taintedCallbackStarted &&
            ['https://js.sentry-cdn.com', 'https://www.googletagmanager.com', 'https://cse.google.com'].includes(new URL(entry.url).origin)
        ),
        false,
        'The marker-bearing failed-cleanup document must not initialize SDKs; the earlier clean article may do so'
      );
    } else {
      assert.equal(await page.evaluate(() => window.sessionStorage.getItem('sso_code_transaction')), null);
      assert.equal(
        /sso_(?:token|code|state|flow|challenge|verifier|start|return|issuer)|code_verifier/i.test(
          new URL(page.url()).search + new URL(page.url()).hash
        ),
        false
      );
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ mode, passed: true, exchanges, actualBuiltUI: true, noBearerURLs: true, noReferrers: true }));
    await context.close();
  }
} finally {
  await browser.close();
}
