import jsutils from '@laisky/js-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { bootstrapApplication } from '../../library/bootstrap';
import {
  consumeSSOBootstrap,
  consumeSSOCallbackToken,
  hasSSOCallbackParameters,
  KvKeySSOTransaction,
  MaxFragmentLength,
} from '../../library/sso';

vi.mock('@laisky/js-utils', () => ({ default: { KvSet: vi.fn(), KvGet: vi.fn(), KvDel: vi.fn() } }));

// 200,000 entries (800 KB) exceed the spread argument limits of V8 (about 125,000 in Chrome)
// and JavaScriptCore (65,536), yet fit within Chrome's 2 MB URL limit.
const LargeEntryCount = 200000;
const ValidRandomValue = 'A'.repeat(43);
// jsdom parses each 800 KB URL in JavaScript, so these cases get more than the default 5 s.
const OversizedTimeout = 30000;

/**
 * ordinaryEntries builds a marker-free form fragment body of the given entry count.
 *
 * @param {number} count - The number of "x=1" entries.
 * @returns {string} The entries joined by "&", without a leading "#".
 */
const ordinaryEntries = (count) => Array(count).fill('x=1').join('&');

/**
 * currentRoute returns the path, query and fragment of the jsdom location.
 *
 * @returns {string} The current same-origin route.
 */
const currentRoute = () => window.location.pathname + window.location.search + window.location.hash;

const OversizedFragments = [
  ['a marker-free fragment', ordinaryEntries(LargeEntryCount)],
  ['a marker hidden after the padding', `${ordinaryEntries(LargeEntryCount)}&sso_token=SYNTHETIC_CANARY`],
  ['a marker in a hash-route query after the padding', `${ordinaryEntries(LargeEntryCount)}#/c?SSO_CODE=SYNTHETIC_CANARY`],
  ['a marker before the padding', `sso_token=SYNTHETIC_CANARY&${ordinaryEntries(LargeEntryCount)}`],
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network forbidden');
    })
  );
  window.sessionStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  document.querySelectorAll('script[src*="sentry-cdn"]').forEach((script) => script.remove());
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

describe('oversized fragments fail closed without throwing', () => {
  test.each(OversizedFragments)(
    'reports %s as possibly carrying a marker',
    (_name, fragment) => {
      window.history.replaceState({}, '', `/p/a/?view=compact#${fragment}`);
      expect(() => hasSSOCallbackParameters()).not.toThrow();
      expect(hasSSOCallbackParameters()).toBe(true);
    },
    OversizedTimeout
  );

  test.each(OversizedFragments)(
    'removes %s from history before rejecting without exchange',
    async (_name, fragment) => {
      window.history.replaceState({}, '', `/p/a/?view=compact#${fragment}`);
      const replaceState = vi.spyOn(window.history, 'replaceState');
      const pending = consumeSSOCallbackToken();
      expect(currentRoute()).toBe('/p/a/?view=compact');
      await expect(pending).rejects.toThrow('Sign-in could not be completed');
      expect(replaceState).toHaveBeenCalledOnce();
      expect(JSON.stringify(replaceState.mock.calls)).not.toContain('SYNTHETIC_CANARY');
      expect(hasSSOCallbackParameters()).toBe(false);
      expect(jsutils.KvSet).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    },
    OversizedTimeout
  );

  test(
    'does not redeem an otherwise valid code callback whose fragment is too long to read',
    async () => {
      window.sessionStorage.setItem(
        KvKeySSOTransaction,
        JSON.stringify({ state: ValidRandomValue, verifier: ValidRandomValue, createdAt: Date.now(), redirectPath: '/pages/0/' })
      );
      window.history.replaceState(
        {},
        '',
        `/?sso_code=${ValidRandomValue}&sso_state=${ValidRandomValue}#${ordinaryEntries(LargeEntryCount)}`
      );
      await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not be completed');
      expect(currentRoute()).toBe('/');
      expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    },
    OversizedTimeout
  );

  test(
    'cleans and rejects an oversized fragment through the bootstrap check',
    async () => {
      window.history.replaceState({}, '', `/#${ordinaryEntries(LargeEntryCount)}&sso_start=1`);
      window.sessionStorage.setItem(KvKeySSOTransaction, 'stale');
      await expect(consumeSSOBootstrap()).rejects.toThrow('Sign-in could not be completed');
      expect(currentRoute()).toBe('/');
      expect(window.sessionStorage.getItem(KvKeySSOTransaction)).toBeNull();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    },
    OversizedTimeout
  );

  test.each(OversizedFragments)(
    'still mounts the application, after cleaning, for %s',
    async (_name, fragment) => {
      window.history.replaceState({}, '', `/p/a/?view=compact#${fragment}`);
      const mountApplication = vi.fn(() => {
        // Optional telemetry and App start only once the URL is clean.
        expect(currentRoute()).toBe('/p/a/?view=compact');
        expect(document.querySelector('script[src*="sentry-cdn"]')).not.toBeNull();
      });
      await expect(bootstrapApplication(mountApplication)).resolves.toBe(true);
      expect(mountApplication).toHaveBeenCalledOnce();
      expect(document.querySelector('[role="alert"]').textContent).toBe('Sign-in could not be completed. Please try again.');
      expect(window.location.href).not.toContain('SYNTHETIC_CANARY');
      expect(jsutils.KvSet).not.toHaveBeenCalled();
    },
    OversizedTimeout
  );
});

describe('fragments within the bound keep their exact readings', () => {
  test('reads a marker-free fragment of exactly the bound and keeps it byte-identical', async () => {
    const fragment = 'x'.repeat(MaxFragmentLength);
    window.history.replaceState({}, '', `/p/a/#${fragment}`);
    expect(hasSSOCallbackParameters()).toBe(false);
    window.history.replaceState({}, '', `/p/a/?sso_token=SYNTHETIC_CANARY#${fragment}`);
    await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not be completed');
    expect(currentRoute()).toBe(`/p/a/#${fragment}`);
  });

  test('fails closed one character past the bound', () => {
    window.history.replaceState({}, '', `/p/a/#${'x'.repeat(MaxFragmentLength + 1)}`);
    expect(hasSSOCallbackParameters()).toBe(true);
  });

  test('finds a marker after thousands of ordinary entries and drops only its entry', async () => {
    const kept = ordinaryEntries(3000);
    window.history.replaceState({}, '', `/p/a/#${kept}&sso_token=SYNTHETIC_CANARY`);
    expect(window.location.hash.length - 1).toBeLessThanOrEqual(MaxFragmentLength);
    expect(hasSSOCallbackParameters()).toBe(true);
    await expect(consumeSSOCallbackToken()).rejects.toThrow('Sign-in could not be completed');
    expect(window.location.hash).toBe(`#${kept}`);
  });

  test('drops the whole fragment when re-encoding the kept entries would exceed the bound', async () => {
    // Form serialization writes each "/" as "%2F", so the kept entry triples in length.
    const fragment = `note=${'/'.repeat(MaxFragmentLength - 40)}&sso_token=SYNTHETIC_CANARY`;
    window.history.replaceState({}, '', `/p/a/#${fragment}`);
    expect(window.location.hash.length - 1).toBeLessThanOrEqual(MaxFragmentLength);
    const mountApplication = vi.fn();
    await expect(bootstrapApplication(mountApplication)).resolves.toBe(true);
    expect(currentRoute()).toBe('/p/a/');
    expect(mountApplication).toHaveBeenCalledOnce();
  });
});
