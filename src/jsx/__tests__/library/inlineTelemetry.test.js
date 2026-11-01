import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SSOCallbackParameters } from '../../library/sso';
import { initializeOptionalTelemetry, TelemetryLoaderURL } from '../../library/telemetry';

vi.mock('@laisky/js-utils', () => ({ default: { KvSet: vi.fn(), KvGet: vi.fn(), KvDel: vi.fn() } }));

const html = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../index.html'), 'utf8');
const inlineLoader = html.match(/<script id="failure-reporting">([\s\S]*?)<\/script>/)[1];

/** runInlineLoader executes the exact shipped inline script against the current jsdom document. */
const runInlineLoader = () => new Function(inlineLoader)();

/** telemetryScripts lists every Sentry loader element in the document. */
const telemetryScripts = () => [...document.querySelectorAll('script[src*="sentry-cdn"]')];

beforeEach(() => {
  delete window.__BLOG_APP_STARTED__;
  window.history.replaceState({}, '', '/p/sample/?view=compact#intro');
});

afterEach(() => {
  telemetryScripts().forEach((script) => script.remove());
  delete window.Sentry;
  // Each run leaves a one-shot load listener; fire it here so it cannot count toward a later test.
  window.dispatchEvent(new window.Event('load'));
  delete window.__BLOG_APP_STARTED__;
  window.history.replaceState({}, '', '/');
});

describe('inline failure reporting in index.html', () => {
  it('runs before the application entry, after the no-referrer policy', () => {
    const referrer = html.indexOf('<meta name="referrer" content="no-referrer"');
    const loader = html.indexOf('id="failure-reporting"');
    const entry = html.indexOf('type="module" src="/src/jsx/main.jsx"');
    expect(referrer).toBeGreaterThan(-1);
    expect(loader).toBeGreaterThan(referrer);
    expect(entry).toBeGreaterThan(loader);
  });

  it('loads the SDK on a clean URL with the same protections as the bundle path', () => {
    runInlineLoader();
    const [script] = telemetryScripts();
    expect(script.src).toBe(TelemetryLoaderURL);
    expect(script.referrerPolicy).toBe('no-referrer');
    expect(script.crossOrigin).toBe('anonymous');
    expect(script.async).toBe(true);
  });

  it.each(SSOCallbackParameters)('keeps the SDK away from callback parameter %s in the query', (parameter) => {
    window.history.replaceState({}, '', `/?${parameter}=local-only`);
    runInlineLoader();
    expect(telemetryScripts()).toHaveLength(0);
  });

  it.each(SSOCallbackParameters)('keeps the SDK away from callback parameter %s in the fragment', (parameter) => {
    window.history.replaceState({}, '', `/#${parameter}=local-only`);
    runInlineLoader();
    expect(telemetryScripts()).toHaveLength(0);
  });

  it('treats callback parameter names case-insensitively, as sso.jsx does', () => {
    window.history.replaceState({}, '', '/?SSO_Token=local-only');
    runInlineLoader();
    expect(telemetryScripts()).toHaveLength(0);
  });

  it('is not loaded twice when the bundle starts after it', () => {
    runInlineLoader();
    expect(initializeOptionalTelemetry()).toBe(true);
    expect(telemetryScripts()).toHaveLength(1);
  });

  it('reports a bundle that never started, without any URL', () => {
    window.Sentry = { captureMessage: vi.fn() };
    runInlineLoader();
    window.dispatchEvent(new window.Event('load'));
    expect(window.Sentry.captureMessage).toHaveBeenCalledOnce();
    const [message, context] = window.Sentry.captureMessage.mock.calls[0];
    expect(message).toBe('application_bundle failed (not_started)');
    expect(context.level).toBe('error');
    expect(JSON.stringify(context)).not.toContain('/p/sample/');
  });

  it('stays quiet when the bundle started', () => {
    window.Sentry = { captureMessage: vi.fn() };
    runInlineLoader();
    window.__BLOG_APP_STARTED__ = true;
    window.dispatchEvent(new window.Event('load'));
    expect(window.Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('does not report from a callback URL, where the SDK is not running', () => {
    window.history.replaceState({}, '', '/?sso_token=local-only');
    window.Sentry = { captureMessage: vi.fn() };
    runInlineLoader();
    window.dispatchEvent(new window.Event('load'));
    expect(window.Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('tolerates a blocked SDK', () => {
    runInlineLoader();
    expect(() => window.dispatchEvent(new window.Event('load'))).not.toThrow();
  });
});
