import jsutils from '@laisky/js-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { KvKeyUserToken } from '../../library/base';
import { consumeSSOCallbackToken, KvKeySSORedirectPath } from '../../library/sso';

vi.mock('@laisky/js-utils', () => ({
  default: { KvSet: vi.fn(), KvDel: vi.fn() },
}));

/**
 * buildSyntheticToken returns an unsigned local-only callback value with the given expiry.
 *
 * @param {number} expiry - The Unix timestamp used in the synthetic payload.
 * @returns {string} A JWT-like string that is not a usable service credential.
 */
const buildSyntheticToken = (expiry) =>
  [
    window.btoa(JSON.stringify({ alg: 'none' })),
    window.btoa(JSON.stringify({ sub: 'local-test-only', exp: expiry })),
    'local-test-only',
  ].join('.');

beforeEach(() => {
  vi.resetAllMocks();
  jsutils.KvSet.mockResolvedValue(undefined);
  jsutils.KvDel.mockResolvedValue(undefined);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network forbidden');
    })
  );
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

test('cleans the callback URL before a pending storage write while preserving legacy login', async () => {
  const token = buildSyntheticToken(Math.floor(Date.now() / 1000) + 60);
  let releaseWrite;
  jsutils.KvSet.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        releaseWrite = resolve;
      })
  );
  window.history.replaceState({}, '', '/pages/0/?view=compact&sso_token=' + encodeURIComponent(token) + '#intro');
  window.sessionStorage.setItem(KvKeySSORedirectPath, '/pages/0/?view=compact#intro');

  const pending = consumeSSOCallbackToken();
  expect(jsutils.KvSet).toHaveBeenCalledTimes(1);
  const urlWhileStoragePending = window.location.pathname + window.location.search + window.location.hash;
  releaseWrite();
  await pending;

  expect(urlWhileStoragePending).toBe('/pages/0/?view=compact#intro');
  expect(jsutils.KvSet).toHaveBeenCalledWith(KvKeyUserToken, token);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('removes invalid callback values before a pending cache deletion', async () => {
  let releaseDeletion;
  jsutils.KvDel.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        releaseDeletion = resolve;
      })
  );
  window.history.replaceState({}, '', '/pages/0/?sso_token=local-invalid&view=compact#intro');

  const pending = consumeSSOCallbackToken();
  const urlWhileDeletionPending = window.location.pathname + window.location.search + window.location.hash;
  releaseDeletion();
  await pending;

  expect(urlWhileDeletionPending).toBe('/pages/0/?view=compact#intro');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).toHaveBeenCalledTimes(2);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('keeps the URL clean when storage writes fail', async () => {
  const token = buildSyntheticToken(Math.floor(Date.now() / 1000) + 60);
  jsutils.KvSet.mockRejectedValueOnce(new Error('Local storage unavailable'));
  window.history.replaceState({}, '', '/pages/0/?sso_token=' + encodeURIComponent(token));

  expect(await consumeSSOCallbackToken()).toBe(true);
  expect(window.location.search).toBe('');
  expect(jsutils.KvDel).toHaveBeenCalledTimes(2);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('keeps the URL clean even if invalid-token cache deletion rejects', async () => {
  jsutils.KvDel.mockRejectedValueOnce(new Error('Local cache deletion unavailable'));
  window.history.replaceState({}, '', '/pages/0/?sso_token=local-invalid');

  await expect(consumeSSOCallbackToken()).rejects.toThrow('Local cache deletion unavailable');
  expect(window.location.search).toBe('');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('removes all duplicated authentication parameters while preserving the other URL parts', async () => {
  window.history.replaceState({}, '', '/pages/0/?sso_token=local-invalid&sso_token=local-other&view=compact#intro');

  expect(await consumeSSOCallbackToken()).toBe(true);
  expect(window.location.pathname + window.location.search + window.location.hash).toBe('/pages/0/?view=compact#intro');
});

test('cleans an empty callback parameter without establishing a session', async () => {
  window.history.replaceState({}, '', '/pages/0/?sso_token=&view=compact#intro');

  expect(await consumeSSOCallbackToken()).toBe(false);
  expect(window.location.pathname + window.location.search + window.location.hash).toBe('/pages/0/?view=compact#intro');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).not.toHaveBeenCalled();
});

test('leaves ordinary URLs and existing storage unchanged', async () => {
  window.history.replaceState({}, '', '/pages/0/?view=compact#intro');

  expect(await consumeSSOCallbackToken()).toBe(false);
  expect(window.location.pathname + window.location.search + window.location.hash).toBe('/pages/0/?view=compact#intro');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).not.toHaveBeenCalled();
});

test('removes expired callback values before a pending cache deletion', async () => {
  const token = buildSyntheticToken(Math.floor(Date.now() / 1000) - 60);
  let releaseDeletion;
  jsutils.KvDel.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        releaseDeletion = resolve;
      })
  );
  window.history.replaceState({}, '', '/pages/0/?sso_token=' + encodeURIComponent(token));

  const pending = consumeSSOCallbackToken();
  const queryWhileDeletionPending = window.location.search;
  releaseDeletion();
  await pending;

  expect(queryWhileDeletionPending).toBe('');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).toHaveBeenCalledTimes(2);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
