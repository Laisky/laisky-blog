import jsutils from '@laisky/js-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { consumeSSOCallbackToken, KvKeySSOTransaction } from '../../library/sso';

vi.mock('@laisky/js-utils', () => ({
  default: { KvSet: vi.fn(), KvGet: vi.fn(), KvDel: vi.fn() },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network forbidden');
    })
  );
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

test.each([
  'sso_token=local-invalid',
  'sso_token=',
  'sso_token=first&sso_token=second',
  'sso_code=' + 'A'.repeat(43) + '&sso_state=' + 'B'.repeat(43) + '&sso_token=local',
  'sso_code=' + 'A'.repeat(43) + '&sso_code=' + 'A'.repeat(43) + '&sso_state=' + 'B'.repeat(43),
  'sso_code=' + 'A'.repeat(43) + '&sso_state=' + 'B'.repeat(43) + '&sso_state=' + 'B'.repeat(43),
  'sso_code=short&sso_state=' + 'B'.repeat(43),
  'sso_code=' + 'A'.repeat(43),
  'sso_state=' + 'B'.repeat(43),
  'sso_flow=code&sso_challenge=local&sso_challenge_method=plain',
])('cleans invalid callback markers synchronously and preserves existing sessions: %s', async (query) => {
  window.history.replaceState({}, '', '/pages/0/?view=compact&' + query + '#intro');
  const pending = consumeSSOCallbackToken();
  expect(window.location.pathname + window.location.search + window.location.hash).toBe('/pages/0/?view=compact#intro');
  await expect(pending).rejects.toThrow('Sign-in could not');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvGet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('rejects a synthetic reusable bearer while preserving a previously stored session', async () => {
  const token = [
    window.btoa('{"alg":"none"}'),
    window.btoa(
      JSON.stringify({
        sub: 'local-only',
        exp: Math.floor(Date.now() / 1000) + 300,
      })
    ),
    'local-only',
  ].join('.');
  window.history.replaceState({}, '', '/pages/0/?sso_token=' + encodeURIComponent(token));
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(window.location.search).toBe('');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('cleans markers before a tab-storage error and never submits an exchange', async () => {
  window.history.replaceState({}, '', '/?sso_code=' + 'A'.repeat(43) + '&sso_state=' + 'B'.repeat(43));
  vi.spyOn(window.Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('unavailable');
  });
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(window.location.search).toBe('');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('leaves ordinary URLs and stored sessions unchanged', async () => {
  window.history.replaceState({}, '', '/pages/0/?view=compact#intro');
  window.sessionStorage.setItem(KvKeySSOTransaction, 'local pending transaction');
  expect(await consumeSSOCallbackToken()).toBe(false);
  expect(window.location.pathname + window.location.search + window.location.hash).toBe('/pages/0/?view=compact#intro');
  expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBe('local pending transaction');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
