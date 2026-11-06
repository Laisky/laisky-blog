import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializeOptionalTelemetry } from '../../library/telemetry';
import { installOfflineSentryAdapter } from '../../library/sentryEventPrivacy';

vi.mock('@laisky/js-utils', () => ({ default: { KvSet: vi.fn(), KvGet: vi.fn(), KvDel: vi.fn() } }));

const html = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../index.html'), 'utf8');
const inline = html.match(/<script id="failure-reporting">([\s\S]*?)<\/script>/)[1];
const config = {
  commit: 'a'.repeat(40),
  build: 'b'.repeat(64),
  environment: 'staging',
  origin: window.location.origin,
  assets: ['/assets/index-123.js'],
};

/** scripts returns the currently inserted telemetry loader elements. */
const scripts = () => [...document.querySelectorAll('script[src*="sentry-cdn"]')];

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.Sentry = {
    init: vi.fn(),
    captureMessage: vi.fn(),
    makeFetchTransport: vi.fn(() => ({ send: vi.fn(), flush: vi.fn() })),
  };
  installOfflineSentryAdapter(window, config);
});

afterEach(() => {
  scripts().forEach((script) => script.remove());
  window.dispatchEvent(new window.Event('load'));
  delete window.sentryOnLoad;
  delete window.Sentry;
  delete window.__BLOG_APP_STARTED__;
  window.history.replaceState({}, '', '/');
});

it.each(['clean', 'callback'])('configures an intercepted SDK before the actual %s loader path', (scenario) => {
  if (scenario === 'callback') window.history.replaceState({}, '', '/?sso_code=TOKEN_CANARY');
  new Function(inline)();
  if (scenario === 'callback') {
    expect(scripts()).toHaveLength(0);
    expect(initializeOptionalTelemetry()).toBe(false);
    window.history.replaceState({}, '', '/');
    expect(initializeOptionalTelemetry()).toBe(true);
  }
  expect(scripts()).toHaveLength(1);
  expect(typeof window.sentryOnLoad).toBe('function');
  // The network loader is intercepted: this simulates its documented callback without contacting Sentry.
  window.sentryOnLoad();
  const options = window.Sentry.init.mock.calls[0][0];
  const event = options.beforeSend({
    request: { url: 'https://blog.example/?token=TOKEN_CANARY', headers: { Cookie: 'COOKIE_CANARY' } },
    exception: {
      values: [
        {
          type: 'TypeError',
          value: 'TOKEN_CANARY',
          stacktrace: { frames: [{ filename: `${window.location.origin}/assets/index-123.js?token=TOKEN_CANARY`, lineno: 5, colno: 9 }] },
        },
      ],
    },
  });
  expect(JSON.stringify(event)).not.toMatch(/TOKEN_CANARY|COOKIE_CANARY/);
  expect(event.exception.values[0].stacktrace.frames[0]).toMatchObject({ lineno: 5, colno: 9 });
});
