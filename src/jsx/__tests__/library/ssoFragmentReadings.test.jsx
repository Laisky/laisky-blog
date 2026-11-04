import jsutils from '@laisky/js-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  consumeSSOBootstrap,
  consumeSSOCallbackToken,
  hasSSOCallbackParameters,
  KvKeySSOTransaction,
  sanitizeRedirectPath,
  SSOCallbackParameters,
} from '../../library/sso';
import protocol from './blog-sso-protocol.v1.json';

vi.mock('@laisky/js-utils', () => ({ default: { KvSet: vi.fn(), KvGet: vi.fn(), KvDel: vi.fn() } }));

const DefaultRoute = '/pages/0/';

/**
 * routeOf derives the same-origin route the issuer would place in sso_return.
 *
 * @param {string} target - An absolute fixture bookmark.
 * @returns {string} The bookmark path, query and fragment.
 */
const routeOf = (target) => {
  const url = new URL(target);
  return url.pathname + url.search + url.hash;
};

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

describe('shared Blog SSO protocol contract v1', () => {
  test('uses the same reserved marker set and return-route bound as the issuer', () => {
    expect(protocol.version).toBe(1);
    expect(new Set(SSOCallbackParameters)).toEqual(new Set(protocol.markers));
    expect(SSOCallbackParameters).toHaveLength(protocol.markers.length);
    const longest = '/' + 'x'.repeat(protocol.maxReturnPathLength - 1);
    expect(sanitizeRedirectPath(longest)).toBe(longest);
    expect(sanitizeRedirectPath(longest + 'x')).toBe(DefaultRoute);
  });

  test.each(protocol.cases.filter((item) => item.returnPath).map((item) => [item.target, item.returnPath]))(
    'accepts the issuer return route for %s unchanged',
    (_target, returnPath) => {
      expect(sanitizeRedirectPath(returnPath)).toBe(returnPath);
    }
  );

  test.each(protocol.cases.filter((item) => item.reject === 'route').map((item) => [item.target]))(
    'rejects the route derived from %s',
    (target) => {
      expect(sanitizeRedirectPath(routeOf(target))).toBe(DefaultRoute);
    }
  );
});

describe('hash-route and nested-fragment markers on the current URL', () => {
  test.each(['/p/a/#/c?sso_token=SYNTHETIC_CANARY', '/p/a/#/a#SSO_CODE=x', '/p/a/#!/c?view=1&sso_state=x'])(
    'detects reserved marker %s before telemetry or App',
    (path) => {
      window.history.replaceState({}, '', path);
      expect(hasSSOCallbackParameters()).toBe(true);
    }
  );

  test.each(['/p/a/#/c?view=compact', '/p/a/#intro#details', '/p/a/#/c?note=sso_token'])(
    'leaves ordinary fragment %s undetected',
    (path) => {
      window.history.replaceState({}, '', path);
      expect(hasSSOCallbackParameters()).toBe(false);
    }
  );

  test.each([
    ['/p/a/?view=compact#/c?sso_token=SYNTHETIC_CANARY', '/p/a/?view=compact'],
    ['/p/a/#/a#SSO_CODE=SYNTHETIC_CANARY', '/p/a/'],
    ['/p/a/?sso_token=SYNTHETIC_CANARY#/c?sso_code=SYNTHETIC_CANARY', '/p/a/'],
    // A marker hidden in the value of an entry that form cleanup keeps must not survive re-encoding.
    ['/p/a/#note=foo?sso_token=SYNTHETIC_CANARY&sso_code=old', '/p/a/'],
    ['/p/a/#note=foo#sso_token=SYNTHETIC_CANARY&sso_code=old', '/p/a/'],
    ['/p/a/#sso_code=old&?sso_token=SYNTHETIC_CANARY', '/p/a/'],
    ['/p/a/#section=intro&#sso_token=SYNTHETIC_CANARY&sso_code=old', '/p/a/#section=intro'],
    ['/p/a/#section=intro&note=foo?SSO%5FTOKEN=SYNTHETIC_CANARY&sso_state=old', '/p/a/#section=intro'],
  ])('cleans %s from history before rejecting without exchange', async (path, cleaned) => {
    window.history.replaceState({}, '', path);
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const pending = consumeSSOCallbackToken();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(cleaned);
    await expect(pending).rejects.toThrow('Sign-in could not');
    expect(replaceState).toHaveBeenCalledOnce();
    expect(JSON.stringify(replaceState.mock.calls)).not.toContain('SYNTHETIC_CANARY');
    expect(window.location.href).not.toContain('SYNTHETIC_CANARY');
    expect(hasSSOCallbackParameters()).toBe(false);
    expect(jsutils.KvSet).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test.each(['#/c?view=compact', '#intro#details', '#note=foo%3Fsso_token%3Dx&section=intro'])(
    'keeps ordinary fragment %s byte-identical while cleaning a query callback',
    async (hash) => {
      window.history.replaceState({}, '', `/p/a/?sso_token=SYNTHETIC_CANARY${hash}`);
      await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
      expect(window.location.search).toBe('');
      expect(window.location.hash).toBe(hash);
    }
  );

  test('keeps the existing whole-form fragment cleanup output unchanged', async () => {
    window.history.replaceState({}, '', '/p/a/#section=intro&sso_token=SYNTHETIC_CANARY');
    await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not');
    expect(window.location.hash).toBe('#section=intro');
  });

  test('detects, cleans and rejects bootstrap markers hidden in a hash-route query', async () => {
    window.history.replaceState({}, '', '/#/x?sso_start=1');
    window.sessionStorage.setItem(KvKeySSOTransaction, 'stale');
    await expect(consumeSSOBootstrap()).rejects.toThrow('Sign-in could not');
    expect(window.location.hash).toBe('');
    expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('cleans a bootstrap marker without keeping a credential hidden in another fragment entry', async () => {
    window.history.replaceState({}, '', '/#note=x?sso_token=SYNTHETIC_CANARY&sso_start=1');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    await expect(consumeSSOBootstrap()).rejects.toThrow('Sign-in could not');
    expect(window.location.hash).toBe('');
    expect(replaceState).toHaveBeenCalledOnce();
    expect(JSON.stringify(replaceState.mock.calls)).not.toContain('SYNTHETIC_CANARY');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
