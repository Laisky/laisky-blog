import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { buildSSOLoginURL, KvKeySSOTransaction, sanitizeRedirectPath, startSSOLogin } from '../../library/sso';

vi.mock('@laisky/js-utils', () => ({ default: { KvSet: vi.fn(), KvGet: vi.fn(), KvDel: vi.fn() } }));

let originalLocation;

/**
 * setLocation installs a navigation double for a supplied absolute URL.
 *
 * @param {string} href - The URL to expose.
 * @returns {object} The navigation double.
 */
const setLocation = (href) => {
  const url = new URL(href);
  delete window.location;
  window.location = { href, origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash, assign: vi.fn() };
  return window.location;
};

beforeEach(() => {
  originalLocation = window.location;
  window.sessionStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => {
  window.location = originalLocation;
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('initiating a bound Blog SSO login', () => {
  test('stores separate random state and verifier, and sends only an S256 challenge in the login URL', async () => {
    const location = setLocation('https://blog.laisky.com/about/site/?force=1#intro');
    await startSSOLogin();
    const transaction = JSON.parse(window.sessionStorage.getItem(KvKeySSOTransaction));
    expect(transaction.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(transaction.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(transaction.state).not.toBe(transaction.verifier);
    expect(transaction.redirectPath).toBe('/about/site/?force=1#intro');
    const login = new URL(location.assign.mock.calls[0][0]);
    const callback = new URL(login.searchParams.get('redirect_to'));
    expect(login.origin).toBe('https://sso.laisky.com');
    expect(callback.origin).toBe('https://blog.laisky.com');
    expect(callback.pathname).toBe('/');
    expect(callback.searchParams.get('sso_flow')).toBe('code');
    expect(callback.searchParams.get('sso_state')).toBe(transaction.state);
    expect(callback.searchParams.get('sso_challenge_method')).toBe('S256');
    const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(transaction.verifier));
    expect(callback.searchParams.get('sso_challenge')).toBe(Buffer.from(digest).toString('base64url'));
    expect(location.assign.mock.calls[0][0]).not.toContain(transaction.verifier);
    expect(callback.searchParams.has('sso_token')).toBe(false);
  });

  test('matches the RFC 7636 S256 challenge example without permitting a plain downgrade', () => {
    const url = new URL(buildSSOLoginURL('A'.repeat(43), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'));
    expect(new URL(url.searchParams.get('redirect_to')).searchParams.get('sso_challenge_method')).toBe('S256');
    expect(() => buildSSOLoginURL('short', 'plain')).toThrow('Sign-in could not');
  });

  test('does not navigate if tab storage is unavailable', async () => {
    const location = setLocation('https://blog.laisky.com/');
    vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    await expect(startSSOLogin()).rejects.toThrow('Sign-in could not');
    expect(location.assign).not.toHaveBeenCalled();
  });

  test('discards the transaction if navigation is interrupted', async () => {
    const location = setLocation('https://blog.laisky.com/');
    location.assign.mockImplementation(() => {
      throw new Error('interrupted');
    });
    await expect(startSSOLogin()).rejects.toThrow('Sign-in could not');
    expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
  });

  test('does not navigate when secure digest support is unavailable', async () => {
    const location = setLocation('https://blog.laisky.com/');
    vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    await expect(startSSOLogin()).rejects.toThrow('Sign-in could not');
    expect(location.assign).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
  });

  test.each([
    'https://other.invalid/',
    '//other.invalid/',
    '/\\other.invalid/',
    '/\n/other.invalid/',
    '/?sso_token=local',
    '/?sso_code=local',
    '/?sso_state=local',
    '/'.repeat(2050),
  ])('rejects an unsafe return route %s', (path) => expect(sanitizeRedirectPath(path)).toBe('/pages/0/'));

  test('normalizes a safe internal route and preserves query and fragment', () => {
    expect(sanitizeRedirectPath('/p/../about/site/?view=compact#intro')).toBe('/about/site/?view=compact#intro');
  });
});
