import jsutils from '@laisky/js-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { KvKeyAuthUser, KvKeyUserToken } from '../../library/base';
import { consumeSSOCallbackToken, KvKeySSOTransaction, SSOExchangeURL, SSOTransactionLifetime } from '../../library/sso';

vi.mock('@laisky/js-utils', () => ({ default: { KvSet: vi.fn(), KvGet: vi.fn(), KvDel: vi.fn() } }));

const code = 'A'.repeat(43);
const state = 'B'.repeat(42) + 'A';
const verifier = 'C'.repeat(42) + 'A';
let originalLocation;
let historySpy;
let token;

/**
 * callbackLocation replaces navigation with a test double at a supplied canonical callback.
 *
 * @param {string} query - The callback query string.
 * @returns {object} The mutable location double.
 */
const callbackLocation = (query = 'sso_code=' + code + '&sso_state=' + state) => {
  const url = new URL('https://blog.laisky.com/?' + query);
  delete window.location;
  window.location = {
    href: url.toString(),
    origin: url.origin,
    pathname: '/',
    search: url.search,
    hash: '',
    replace: vi.fn(),
  };
  return window.location;
};

/**
 * jsonResponse returns a bounded streaming response for mocked issuer data.
 *
 * @param {object} data - The response body.
 * @param {object} options - Optional status and content-type changes.
 * @returns {object} The fetch response double.
 */
const jsonResponse = (data, options = {}) => {
  let consumed = false;
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return {
    ok: options.ok ?? true,
    headers: { get: () => options.contentType ?? 'application/json; charset=utf-8' },
    body: {
      getReader: () => ({
        read: async () => {
          if (consumed) return { done: true };
          consumed = true;
          return { done: false, value: bytes };
        },
        cancel: vi.fn(),
      }),
    },
  };
};

/**
 * storeTransaction persists a local transaction with optional overrides.
 *
 * @param {object} changes - Transaction fields to replace.
 * @returns {void} No return value.
 */
const storeTransaction = (changes = {}) =>
  window.sessionStorage.setItem(
    KvKeySSOTransaction,
    JSON.stringify({
      state,
      verifier,
      createdAt: Date.now(),
      redirectPath: '/publish/?view=compact#intro',
      ...changes,
    })
  );

/**
 * tokenResponse returns an existing bearer-shaped response without a real service credential.
 *
 * @param {object} changes - Response fields to replace.
 * @returns {object} The mocked issuer response.
 */
const tokenResponse = (changes = {}) => jsonResponse({ access_token: token, token_type: 'Bearer', expires_in: 300, ...changes });

beforeEach(() => {
  vi.resetAllMocks();
  originalLocation = window.location;
  callbackLocation();
  historySpy = vi.spyOn(window.history, 'replaceState').mockImplementation((_state, _title, path) => {
    const url = new URL(path, 'https://blog.laisky.com');
    Object.assign(window.location, { href: url.toString(), pathname: url.pathname, search: url.search, hash: url.hash });
  });
  /**
   * encode returns URL-safe JSON for local-only synthetic JWT claims.
   *
   * @param {object} value - The local fixture claims.
   * @returns {string} The encoded payload.
   */
  const encode = (value) => window.btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  token = encode({ alg: 'none' }) + '.' + encode({ sub: 'local-only', exp: Math.floor(Date.now() / 1000) + 300 }) + '.local-only';
  window.sessionStorage.clear();
  storeTransaction();
  jsutils.KvGet.mockResolvedValue(undefined);
  jsutils.KvSet.mockResolvedValue(undefined);
  jsutils.KvDel.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(tokenResponse()));
});
afterEach(() => {
  historySpy.mockRestore();
  window.location = originalLocation;
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('exchanges once, removes markers before I/O, and restores the safe initiating route', async () => {
  const location = window.location;
  globalThis.fetch.mockImplementation(async (url, options) => {
    expect(window.location.search).toBe('');
    expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
    expect(url).toBe(SSOExchangeURL);
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    expect(JSON.parse(options.body)).toEqual({
      client_id: 'blog',
      redirect_uri: 'https://blog.laisky.com',
      code,
      state,
      code_verifier: verifier,
    });
    expect(url).not.toContain(code);
    return tokenResponse();
  });
  expect(await consumeSSOCallbackToken()).toBe(true);
  expect(jsutils.KvSet).toHaveBeenCalledWith(KvKeyUserToken, token);
  expect(jsutils.KvSet).toHaveBeenCalledWith(KvKeyAuthUser, expect.objectContaining({ sub: 'local-only' }));
  expect(location.replace).toHaveBeenCalledWith('/publish/?view=compact#intro');
  callbackLocation();
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});

test.each([
  { state: 'D'.repeat(43) },
  { verifier: 'short' },
  { createdAt: 0 },
  { createdAt: Date.now() + 600000 },
  { createdAt: Date.now() - SSOTransactionLifetime - 1000 },
])('rejects a mismatched, expired, future, or malformed transaction before I/O: %j', async (changes) => {
  storeTransaction(changes);
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(window.location.search).toBe('');
  expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(jsutils.KvSet).not.toHaveBeenCalled();
});

test.each(['null', '{', 'x'.repeat(4097)])('rejects corrupt transaction storage: %s', async (raw) => {
  window.sessionStorage.setItem(KvKeySSOTransaction, raw);
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test.each([
  { token_type: 'Basic' },
  { expires_in: 0 },
  { access_token: 'opaque' },
  { access_token: 'x'.repeat(16385) },
  { access_token: 'eyJhbGciOiJub25lIn0.eyJleHAiOjB9.local' },
])('rejects malformed or expired issuer credentials without writing a session: %j', async (changes) => {
  globalThis.fetch.mockResolvedValue(tokenResponse(changes));
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).not.toHaveBeenCalled();
  expect(window.location.search).toBe('');
});

test.each([{ ok: false }, { contentType: 'text/html' }])('rejects issuer errors and unexpected content types: %j', async (options) => {
  globalThis.fetch.mockResolvedValue(jsonResponse({}, options));
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
});

test('bounds issuer response bytes before parsing', async () => {
  globalThis.fetch.mockResolvedValue(jsonResponse({ value: 'x'.repeat(32769) }));
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
});

test('an interrupted exchange consumes the transaction and leaves existing sessions intact', async () => {
  globalThis.fetch.mockRejectedValue(new Error('interrupted'));
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  callbackLocation();
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(jsutils.KvDel).not.toHaveBeenCalled();
  expect(jsutils.KvSet).not.toHaveBeenCalled();
});

test('aborts a stalled exchange at the bounded deadline', async () => {
  vi.useFakeTimers();
  globalThis.fetch.mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      })
  );
  const pending = expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  await vi.advanceTimersByTimeAsync(10000);
  await pending;
  expect(window.location.search).toBe('');
  expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
});

test('restores a prior session after a partial write failure', async () => {
  const oldUser = { sub: 'previous-local' };
  jsutils.KvGet.mockResolvedValueOnce(oldUser).mockResolvedValueOnce('previous-local-token');
  jsutils.KvSet.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('storage unavailable')).mockResolvedValue(undefined);
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(jsutils.KvSet).toHaveBeenCalledWith(KvKeyAuthUser, oldUser);
  expect(jsutils.KvSet).toHaveBeenCalledWith(KvKeyUserToken, 'previous-local-token');
  expect(window.location.replace).not.toHaveBeenCalled();
});

test('removes partial new auth keys when there was no prior session', async () => {
  jsutils.KvSet.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(jsutils.KvDel).toHaveBeenCalledWith(KvKeyAuthUser);
  expect(jsutils.KvDel).toHaveBeenCalledWith(KvKeyUserToken);
  expect(window.location.search).toBe('');
});

test('does not write when existing session storage cannot be read', async () => {
  jsutils.KvGet.mockRejectedValueOnce(new Error('unavailable'));
  await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
  expect(jsutils.KvSet).not.toHaveBeenCalled();
});

test('uses the safe fallback for an externally targeted stored return path', async () => {
  storeTransaction({ redirectPath: '/\\other.invalid/' });
  await consumeSSOCallbackToken();
  expect(window.location.replace).toHaveBeenCalledWith('/pages/0/');
});
