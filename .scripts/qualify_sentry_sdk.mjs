/* global process, console, window */
/**
 * Run the actual public @sentry/browser SDK in a local intercepted browser fixture.
 * Requires an independently installed @sentry/browser@7.120.4 package and Playwright;
 * SDK_ENTRY points to its esm/index.js and PLAYWRIGHT_MODULE to Playwright's entry.
 * Install the package separately with Yarn; verify the official tarball SHA-512 before use:
 * sha512-ymlNtIPG6HAKzM/JXpWVGCzCNufZNADfy+O/olZuVJW5Be1DtOFyRnBvz0LeKbmxJbXb2lX/XMhuen6PXPdoQw==
 * Browser requests are fulfilled or aborted locally; no telemetry leaves the fixture.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const sdkEntry = process.env.SDK_ENTRY;
if (!sdkEntry || !path.isAbsolute(sdkEntry)) throw new Error('SDK_ENTRY must point to the locally installed SDK entry');
const packageJson = JSON.parse(await readFile(path.resolve(path.dirname(sdkEntry), '../package.json'), 'utf8'));
assert.equal(packageJson.name, '@sentry/browser');
assert.equal(packageJson.version, '7.120.4');
const browserModule = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(browserModule ? pathToFileURL(browserModule).href : 'playwright');
const privacy = path.resolve('src/jsx/library/sentryEventPrivacy.js');
const telemetry = path.resolve('src/jsx/library/telemetry.jsx');
const early = path.resolve('src/jsx/library/sentryEarlyErrorBuffer.js');
const entry = `
import * as SDK from ${JSON.stringify(sdkEntry)};
import { installOfflineSentryAdapter } from ${JSON.stringify(privacy)};
import { initializeOptionalTelemetry } from ${JSON.stringify(telemetry)};
import { installEarlyErrorBuffer } from ${JSON.stringify(early)};
window.__sdkVersion = SDK.SDK_VERSION;
window.__messages = [];
window.__prepare = () => installOfflineSentryAdapter(window, {
  commit: 'a'.repeat(40), build: 'b'.repeat(64), environment:'staging',
  origin: location.origin, assets:['/assets/index-123.js']
});
window.__installEarly = () => { window.__buffer = installEarlyErrorBuffer(window, {cleanUrl:true, origin:location.origin, assets:['/assets/index-123.js']}); };
window.__loadSDK = () => {
  window.__buffer?.stop();
  window.Sentry = {...SDK, init: options => SDK.init({...options, dsn:'https://public@sentry.invalid/1'})};
  window.sentryOnLoad();
  window.__buffer?.flush(window.Sentry);
};
window.__tryBeforeCleanup = () => initializeOptionalTelemetry();
window.__afterCleanup = () => { history.replaceState({}, '', '/'); return initializeOptionalTelemetry(); };
window.__emit = () => SDK.captureEvent({
  message:'MESSAGE_CANARY', user:{id:'USER_CANARY', ip_address:'IP_CANARY'},
  request:{url:'https://blog.example/?token=QUERY_CANARY', headers:{Cookie:'COOKIE_CANARY'}, data:'BODY_CANARY'},
  extra:{dom:'DOM_CANARY', storage:'STORAGE_CANARY'}, breadcrumbs:[{message:'BREADCRUMB_CANARY'}],
  exception:{values:[{type:'TypeError',value:'TOKEN_CANARY',stacktrace:{frames:[
    {filename:'https://blog.example/assets/index-123.js?TOKEN_CANARY',lineno:5,colno:9,vars:{x:'TOKEN_CANARY'}}
  ]}}]}
});
window.__emitNonErrors = () => {
  SDK.startSession(); SDK.captureSession();
  SDK.captureEvent({type:'transaction', transaction:'TRANSACTION_CANARY', spans:[]});
  SDK.withScope(scope => {
    scope.addAttachment({filename:'ATTACHMENT_CANARY.txt',data:'ATTACHMENT_CANARY'});
    SDK.captureException(new Error('ERROR_CANARY'));
  });
};
window.__flush = () => SDK.flush(2000);
`;
const result = await build({
  configFile: false,
  logLevel: 'silent',
  resolve: { alias: [{ find: /^@laisky\/js-utils$/, replacement: '@laisky/js-utils/dist/index.esm.js' }] },
  plugins: [
    {
      name: 'local-sdk-fixture',
      resolveId(id) {
        if (id === 'virtual:sdk-fixture') return '\0sdk-fixture';
      },
      load(id) {
        if (id === '\0sdk-fixture') return entry;
      },
    },
  ],
  build: { write: false, minify: false, rolldownOptions: { input: 'virtual:sdk-fixture', output: { format: 'iife' } } },
});
const bundle = result.output.find((output) => output.type === 'chunk').code;
const html = await readFile('index.html', 'utf8');
const inline = html.match(/<script id="failure-reporting">([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline, 'inline loader exists');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', headless: true });
try {
  for (const scenario of ['clean', 'buffer', 'callback']) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const calls = [];
    let observedParseError;
    const parseErrorSeen = new Promise((resolve) => {
      observedParseError = resolve;
    });
    await context.route('**/*', async (route) => {
      const req = route.request();
      const url = req.url();
      calls.push({ method: req.method(), url, body: req.postData() });
      if (url === 'https://blog.example/fixture.js') {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: `${bundle}\nwindow.__prepare();${scenario === 'buffer' ? 'window.__installEarly();' : ''}`,
        });
      }
      if (url === 'https://blog.example/assets/index-123.js') {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'const broken = ;' });
      }
      if (url.startsWith('https://blog.example/')) {
        const broken = scenario !== 'callback' ? '<script type="module" src="/assets/index-123.js"></script>' : '';
        return route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `<head><script src="/fixture.js"></script><script>${inline}</script>${broken}</head>`,
        });
      }
      if (url.startsWith('https://js.sentry-cdn.com/')) {
        if (scenario !== 'callback') await parseErrorSeen;
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__loadSDK();' });
      }
      if (url.startsWith('https://sentry.invalid/')) return route.fulfill({ status: 200, body: '{}' });
      return route.abort();
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
      observedParseError();
    });
    await page.goto(`https://blog.example/${scenario === 'callback' ? '?sso_code=TOKEN_CANARY' : ''}`, { waitUntil: 'load' });
    assert.equal(await page.evaluate(() => window.__sdkVersion), '7.120.4');
    if (scenario === 'callback') {
      assert.equal(calls.filter((c) => c.url.startsWith('https://js.sentry-cdn.com/')).length, 0);
      assert.equal(await page.evaluate(() => window.__tryBeforeCleanup()), false);
      assert.equal(await page.evaluate(() => window.__afterCleanup()), true);
    }
    await page.waitForFunction(() => Boolean(window.Sentry?.getClient?.()));
    await page.evaluate(async () => {
      window.__emit();
      window.__emitNonErrors();
      await window.__flush();
    });
    const envelopes = calls.filter((c) => c.url.startsWith('https://sentry.invalid/') && c.method === 'POST');
    assert.ok(envelopes.length, `${scenario}: SDK sent no envelope to intercepted transport`);
    const body = envelopes.map((request) => request.body).join('\n');
    const itemHeaders = body.split('\n').flatMap((line) => {
      try {
        const value = JSON.parse(line);
        return typeof value?.type === 'string' ? [value.type] : [];
      } catch {
        return [];
      }
    });
    assert.ok(
      itemHeaders.length > 0 && itemHeaders.every((type) => type === 'event'),
      'only error-event items may leave the guarded transport'
    );
    for (const canary of [
      'MESSAGE_CANARY',
      'USER_CANARY',
      'IP_CANARY',
      'QUERY_CANARY',
      'COOKIE_CANARY',
      'BODY_CANARY',
      'DOM_CANARY',
      'STORAGE_CANARY',
      'BREADCRUMB_CANARY',
      'TOKEN_CANARY',
      'TRANSACTION_CANARY',
      'ATTACHMENT_CANARY',
      'ERROR_CANARY',
    ])
      assert.ok(!body.includes(canary), `${scenario}: leaked ${canary}`);
    if (scenario !== 'callback') {
      assert.ok(
        pageErrors.some((message) => message.includes('Unexpected token')),
        'malformed entry must produce a real browser syntax error'
      );
      assert.ok(body.includes('application_bundle failed (not_started)'), 'startup fallback must survive actual SDK serialization');
    }
    if (scenario === 'clean') assert.ok(!body.includes('SyntaxError'), 'negative control must precede the SDK');
    if (scenario === 'buffer') {
      const events = body.split('\n').flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
      const syntaxEvents = events.filter((event) => event.exception?.values?.some((value) => value.type === 'SyntaxError'));
      assert.equal(syntaxEvents.length, 1, 'one buffered syntax event must be captured');
      const frames = syntaxEvents[0].exception.values[0].stacktrace.frames;
      assert.equal(frames[0].filename, 'https://blog.example/assets/index-123.js');
      assert.ok(frames[0].lineno > 0 && frames[0].colno > 0, 'buffered error keeps real source coordinates');
    }
    assert.ok(body.includes('index-123.js') && body.includes('"lineno":5') && body.includes('"colno":9'));
    console.log(
      JSON.stringify({
        scenario,
        sdk: '7.120.4',
        interceptedEnvelopes: envelopes.length,
        syntaxErrorCaptured: body.includes('SyntaxError'),
        canaries: 'absent',
        position: 'preserved',
      })
    );
    await context.close();
  }
} finally {
  await browser.close();
}
