import { afterEach, expect, test, vi } from 'vitest';
import { consumeSSOCallbackToken } from '../../library/sso';
import { initializeOptionalTelemetry } from '../../library/telemetry';

vi.mock('@laisky/js-utils', () => ({ default: { KvSet: vi.fn(), KvGet: vi.fn(), KvDel: vi.fn() } }));

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll('script[src*="sentry-cdn"]').forEach((script) => script.remove());
  window.history.replaceState({}, '', '/');
});

test.each(['sso_token', 'sso_code', 'sso_state', 'sso_flow', 'sso_challenge', 'sso_challenge_method', 'code_verifier', 'sso_verifier'])(
  'does not initialize optional telemetry while callback marker %s remains',
  (parameter) => {
    window.history.replaceState({}, '', '/?' + parameter + '=local-only');
    expect(initializeOptionalTelemetry()).toBe(false);
    expect(document.querySelector('script[src*="sentry-cdn"]')).toBeNull();
  }
);

test('initializes only after callback cleanup, using no-referrer', () => {
  window.history.replaceState({}, '', '/pages/0/?view=compact#intro');
  expect(initializeOptionalTelemetry()).toBe(true);
  const script = document.querySelector('script[src*="sentry-cdn"]');
  expect(script.referrerPolicy).toBe('no-referrer');
  expect(script.crossOrigin).toBe('anonymous');
});

test('keeps telemetry disabled if browser history cleanup fails', async () => {
  window.history.replaceState({}, '', '/?sso_token=local-only-canary');
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
    throw new Error('unavailable');
  });
  await expect(consumeSSOCallbackToken()).rejects.toThrow('unavailable');
  expect(initializeOptionalTelemetry()).toBe(false);
  expect(document.querySelector('script[src*="sentry-cdn"]')).toBeNull();
});
