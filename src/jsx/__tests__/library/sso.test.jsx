import jsutils from '@laisky/js-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { KvKeyAuthUser, KvKeyUserToken } from '../../library/base';
import { buildSSOLoginURL, consumeSSOCallbackToken, KvKeySSORedirectPath, startSSOLogin } from '../../library/sso';

vi.mock('@laisky/js-utils', () => ({
  default: {
    KvSet: vi.fn(),
    KvDel: vi.fn(),
  },
}));

/**
 * buildToken creates a JWT-like token string used by SSO callback tests.
 *
 * @param {object} payload - The payload object to encode into token body.
 * @returns {string} A token string with base64url encoded payload.
 */
const buildToken = (payload) => {
  /**
   * b64url encodes object JSON into base64url format.
   *
   * @param {object} obj - The object to encode.
   * @returns {string} Encoded base64url text.
   */
  const b64url = (obj) => {
    const json = JSON.stringify(obj);
    return window.btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.`;
};

/**
 * setMockLocation replaces window.location with a mutable test double.
 *
 * @param {string} href - The URL to expose as current location.
 * @returns {{assignMock: import('vitest').Mock, replaceMock: import('vitest').Mock}} Mocked location methods.
 */
const setMockLocation = (href) => {
  const url = new URL(href);
  const assignMock = vi.fn();
  const replaceMock = vi.fn();

  delete window.location;
  window.location = {
    href: url.toString(),
    origin: url.origin,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    assign: assignMock,
    replace: replaceMock,
  };

  return { assignMock, replaceMock };
};

describe('sso library', () => {
  let originalLocation;
  let replaceStateSpy;

  beforeEach(() => {
    originalLocation = window.location;
    replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.location = originalLocation;
    replaceStateSpy.mockRestore();
    window.sessionStorage.clear();
  });

  test('buildSSOLoginURL uses SSO host and blog callback URL', () => {
    const ssoURL = new URL(buildSSOLoginURL());
    expect(ssoURL.origin).toBe('https://sso.laisky.com');
    expect(ssoURL.searchParams.get('redirect_to')).toBe('https://blog.laisky.com');
  });

  test('startSSOLogin stores current path and redirects to SSO page', () => {
    const { assignMock } = setMockLocation('https://blog.laisky.com/about/site/?force=1#intro');

    startSSOLogin();

    expect(window.sessionStorage.getItem(KvKeySSORedirectPath)).toBe('/about/site/?force=1#intro');
    expect(assignMock).toHaveBeenCalledWith(buildSSOLoginURL());
  });

  test('consumeSSOCallbackToken stores auth data and redirects to previous path', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 300;
    const token = buildToken({ exp: futureExp, display_name: 'Alice', username: 'alice@example.com' });
    const { replaceMock } = setMockLocation(`https://blog.laisky.com/?sso_token=${token}`);
    window.sessionStorage.setItem(KvKeySSORedirectPath, '/publish/');

    const handled = await consumeSSOCallbackToken();

    expect(handled).toBe(true);
    expect(jsutils.KvSet).toHaveBeenCalledWith(KvKeyAuthUser, expect.objectContaining({ display_name: 'Alice' }));
    expect(jsutils.KvSet).toHaveBeenCalledWith(KvKeyUserToken, token);
    expect(replaceMock).toHaveBeenCalledWith('/publish/');
    expect(window.sessionStorage.getItem(KvKeySSORedirectPath)).toBeNull();
  });

  test('consumeSSOCallbackToken clears auth cache for invalid token and removes token from URL', async () => {
    const expiredExp = Math.floor(Date.now() / 1000) - 300;
    const token = buildToken({ exp: expiredExp, display_name: 'Alice' });
    const { replaceMock } = setMockLocation(`https://blog.laisky.com/?sso_token=${token}`);
    window.sessionStorage.setItem(KvKeySSORedirectPath, '/publish/');

    const handled = await consumeSSOCallbackToken();

    expect(handled).toBe(true);
    expect(jsutils.KvSet).not.toHaveBeenCalled();
    expect(jsutils.KvDel).toHaveBeenCalledWith(KvKeyAuthUser);
    expect(jsutils.KvDel).toHaveBeenCalledWith(KvKeyUserToken);
    expect(replaceMock).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, '/');
  });
});
