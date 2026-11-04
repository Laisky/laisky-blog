import { webcrypto } from 'node:crypto';
import jsutils from '@laisky/js-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { bootstrapApplication } from '../../library/bootstrap';
import { KvKeySSOTransaction } from '../../library/sso';
import { initializeOptionalTelemetry } from '../../library/telemetry';

vi.mock('@laisky/js-utils', () => ({ default: { KvGet: vi.fn(), KvSet: vi.fn(), KvDel: vi.fn() } }));
vi.mock('../../library/telemetry', () => ({ initializeOptionalTelemetry: vi.fn() }));

let originalLocation;

/**
 * bootstrapLocation installs an inert navigation double at the fixed Blog bootstrap.
 *
 * @param {string} query - The bootstrap query.
 * @returns {object} The mutable location double.
 */
const bootstrapLocation = (query = 'sso_start=1&sso_return=' + encodeURIComponent('/p/article/?view=compact#intro')) => {
  const url = new URL('https://blog.laisky.com/?' + query);
  delete window.location;
  window.location = {
    href: url.toString(),
    origin: url.origin,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    assign: vi.fn(),
    replace: vi.fn(),
  };
  return window.location;
};

beforeEach(() => {
  vi.resetAllMocks();
  originalLocation = window.location;
  bootstrapLocation();
  window.sessionStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network forbidden');
    })
  );
  vi.spyOn(window.history, 'replaceState').mockImplementation((_state, _title, path) => {
    const url = new URL(path, 'https://blog.laisky.com');
    Object.assign(window.location, { href: url.toString(), pathname: url.pathname, search: url.search, hash: url.hash });
  });
});
afterEach(() => {
  window.location = originalLocation;
  window.sessionStorage.clear();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('continues a legacy Blog bookmark with a fresh consumer-owned PKCE transaction', async () => {
  window.sessionStorage.setItem(KvKeySSOTransaction, JSON.stringify({ state: 'stale', verifier: 'stale' }));
  const mount = vi.fn();
  expect(await bootstrapApplication(mount)).toBe(false);
  const transaction = JSON.parse(window.sessionStorage.getItem(KvKeySSOTransaction));
  expect(transaction.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(transaction.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(transaction.state).not.toBe(transaction.verifier);
  expect(transaction.redirectPath).toBe('/p/article/?view=compact#intro');
  expect(window.location.search).toBe('');
  expect(window.location.assign).toHaveBeenCalledOnce();
  const login = new URL(window.location.assign.mock.calls[0][0]);
  const binding = new URL(login.searchParams.get('redirect_to'));
  expect(binding.origin).toBe('https://blog.laisky.com');
  expect(binding.pathname).toBe('/');
  expect(binding.searchParams.get('sso_flow')).toBe('code');
  expect(binding.searchParams.get('sso_state')).toBe(transaction.state);
  expect(binding.searchParams.get('sso_challenge_method')).toBe('S256');
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(transaction.verifier));
  expect(binding.searchParams.get('sso_challenge')).toBe(Buffer.from(digest).toString('base64url'));
  expect(login.toString()).not.toContain(transaction.verifier);
  expect(mount).not.toHaveBeenCalled();
  expect(initializeOptionalTelemetry).not.toHaveBeenCalled();
  expect(jsutils.KvGet).not.toHaveBeenCalled();
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('blocks a legacy Blog bootstrap when synchronous history cleanup fails', async () => {
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
    throw new Error('unavailable');
  });
  const mount = vi.fn();
  expect(await bootstrapApplication(mount)).toBe(false);
  expect(mount).not.toHaveBeenCalled();
  expect(window.location.assign).not.toHaveBeenCalled();
  expect(initializeOptionalTelemetry).not.toHaveBeenCalled();
  expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
});

test.each([
  'sso_start=other&sso_return=%2F',
  'sso_start=1&sso_return=%2F&sso_issuer=other',
  'sso_start=1&sso_return=%2F&sso_issuer=https%3A%2F%2Fother.invalid',
  'sso_start=1&sso_return=%2F&sso_issuer=mcp&sso_issuer=sso',
  'sso_start=1&sso_return=%2F&SSO_ISSUER=mcp',
  'SSO_START=1&sso_return=%2F',
  'sso_issuer=mcp',
  'sso_start=1&sso_return=%2F&SSO_TOKEN=old',
  'sso_start=1&sso_return=%2F%3FSSO_TOKEN%3Dold',
  'sso_start=1&sso_return=%2F%23SSO_CODE%3Dold',
  'sso_start=1',
  'sso_return=%2F',
  'sso_start=1&sso_start=1&sso_return=%2F',
  'sso_start=1&sso_return=%2F&sso_return=%2F',
  'sso_start=1&sso_return=https%3A%2F%2Fother.invalid%2F',
  'sso_start=1&sso_return=%2F%2Fother.invalid%2F',
  'sso_start=1&sso_return=%2F%5Cother.invalid%2F',
  'sso_start=1&sso_return=%2F%0Aarticle',
  'sso_start=1&sso_return=%2F%3Fsso_token%3Dold',
  'sso_start=1&sso_return=%2F%23sso_token%3Dold',
  'sso_start=1&sso_return=' + encodeURIComponent('/' + 'x'.repeat(2050)),
  'sso_start=1&sso_return=%2F&extra=value',
  'sso_start=1&sso_return=%2F&sso_token=old',
  'sso_start=1&sso_return=%2F&sso_code=' + 'A'.repeat(43) + '&sso_state=' + 'A'.repeat(43),
])('rejects malformed or mixed bootstrap %s while preserving existing sessions', async (query) => {
  bootstrapLocation(query);
  window.sessionStorage.setItem(KvKeySSOTransaction, 'stale');
  const mount = vi.fn();
  expect(await bootstrapApplication(mount)).toBe(true);
  expect(window.location.search).toBe(query.includes('extra=') ? '?extra=value' : '');
  expect(window.location.assign).not.toHaveBeenCalled();
  expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(jsutils.KvGet).not.toHaveBeenCalled();
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  expect(mount).toHaveBeenCalledOnce();
});

test.each(['digest', 'storage', 'navigation'])(
  'cleans a failed bootstrap %s without leaving a transaction or altering sessions',
  async (failure) => {
    if (failure === 'digest')
      vi.stubGlobal('crypto', {
        getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
        subtle: { digest: vi.fn().mockRejectedValue(new Error('unavailable')) },
      });
    if (failure === 'storage')
      vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('unavailable');
      });
    if (failure === 'navigation')
      window.location.assign.mockImplementation(() => {
        throw new Error('interrupted');
      });
    const mount = vi.fn();
    expect(await bootstrapApplication(mount)).toBe(true);
    expect(window.location.search).toBe('');
    expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
    expect(jsutils.KvSet).not.toHaveBeenCalled();
    expect(jsutils.KvDel).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
  }
);

test.each([
  'http://blog.laisky.com/?sso_start=1&sso_return=%2F',
  'https://blog.laisky.com/pages/0/?sso_start=1&sso_return=%2F',
  'https://blog.laisky.com/?sso_start=1&sso_return=%2F#intro',
])('rejects bootstrap outside the exact HTTPS root %s', async (href) => {
  const url = new URL(href);
  Object.assign(window.location, { href, origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash });
  const mount = vi.fn();
  expect(await bootstrapApplication(mount)).toBe(true);
  expect(window.location.assign).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(jsutils.KvGet).not.toHaveBeenCalled();
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
});

test.each([
  ['mcp', 'https://mcp.laisky.com', '/sso/login'],
  ['sso', 'https://sso.laisky.com', '/'],
])('uses only the fixed %s login entry with unchanged canonical callback', async (issuer, origin, pathname) => {
  bootstrapLocation('sso_start=1&sso_return=%2Fp%2Farticle%2F&sso_issuer=' + issuer);
  expect(await bootstrapApplication(vi.fn())).toBe(false);
  const login = new URL(window.location.assign.mock.calls[0][0]);
  expect(login.origin).toBe(origin);
  expect(login.pathname).toBe(pathname);
  expect(login.searchParams.get('sso_issuer')).toBeNull();
  const callback = new URL(login.searchParams.get('redirect_to'));
  expect(callback.origin).toBe('https://blog.laisky.com');
  expect(callback.pathname).toBe('/');
  expect([...callback.searchParams.keys()]).toEqual(['sso_flow', 'sso_state', 'sso_challenge', 'sso_challenge_method']);
  expect(JSON.parse(window.sessionStorage.getItem(KvKeySSOTransaction)).redirectPath).toBe('/p/article/');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test.each([
  'SSO_TOKEN=old',
  'sso_code=' + 'A'.repeat(43) + '&sso_state=' + 'A'.repeat(43) + '&SSO_TOKEN=old',
  'SSO_CODE=' + 'A'.repeat(43) + '&sso_state=' + 'A'.repeat(43),
])('cleans and rejects legacy or mixed callback aliases %s before exchange', async (query) => {
  bootstrapLocation(query);
  window.sessionStorage.setItem(KvKeySSOTransaction, 'stale');
  expect(await bootstrapApplication(vi.fn())).toBe(true);
  expect(window.location.search).toBe('');
  expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
});

test.each([
  '#SSO_TOKEN=old',
  '?sso_code=' + 'A'.repeat(43) + '&sso_state=' + 'A'.repeat(43) + '#SSO_TOKEN=old',
  '#SSO_START=1&sso_return=%2F',
])('cleans known current-location fragment markers %s before exchange or telemetry', async (suffix) => {
  const url = new URL('https://blog.laisky.com/' + suffix);
  Object.assign(window.location, { href: url.toString(), search: url.search, hash: url.hash });
  window.sessionStorage.setItem(
    KvKeySSOTransaction,
    JSON.stringify({
      state: 'A'.repeat(43),
      verifier: 'A'.repeat(43),
      createdAt: Date.now(),
      redirectPath: '/pages/0/',
    })
  );
  expect(await bootstrapApplication(vi.fn())).toBe(true);
  expect(window.location.search).toBe('');
  expect(window.location.hash).toBe('');
  expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  expect(initializeOptionalTelemetry).toHaveBeenCalledOnce();
});

test.each(['#intro', '#/article?view=compact', '#token=ordinary-article-data'])(
  'preserves ordinary nonprotocol article fragment %s',
  async (hash) => {
    Object.assign(window.location, { href: 'https://blog.laisky.com/pages/0/' + hash, search: '', hash });
    expect(await bootstrapApplication(vi.fn())).toBe(true);
    expect(window.location.hash).toBe(hash);
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  }
);

test('keeps App and telemetry unmounted when reserved fragment cleanup fails', async () => {
  Object.assign(window.location, {
    href: 'https://blog.laisky.com/#SSO_TOKEN=LOCAL_ONLY_CANARY',
    search: '',
    hash: '#SSO_TOKEN=LOCAL_ONLY_CANARY',
  });
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
    throw new Error('unavailable');
  });
  const mount = vi.fn();
  expect(await bootstrapApplication(mount)).toBe(false);
  expect(mount).not.toHaveBeenCalled();
  expect(initializeOptionalTelemetry).not.toHaveBeenCalled();
  expect(window.location.hash).toBe('#SSO_TOKEN=LOCAL_ONLY_CANARY');
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
});
