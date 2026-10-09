import jsutils from '@laisky/js-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { bootstrapApplication } from '../../library/bootstrap';

vi.mock('@laisky/js-utils', () => ({
  default: { KvGet: vi.fn(), KvSet: vi.fn(), KvDel: vi.fn() },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network forbidden');
    })
  );
  document.body.innerHTML = '<div id="root">Original placeholder</div>';
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
  window.sessionStorage.clear();
  document.body.innerHTML = '';
});

test('does not mount App or any optional SDK when browser history cleanup fails', async () => {
  window.history.replaceState({}, '', '/?sso_token=LOCAL_ONLY_CANARY');
  const mountApplication = vi.fn();
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
    throw new Error('unavailable');
  });
  expect(await bootstrapApplication(mountApplication)).toBe(false);
  expect(mountApplication).not.toHaveBeenCalled();
  expect(document.querySelector('script')).toBeNull();
  expect(document.querySelector('[role="alert"]').textContent).toBe('Sign-in could not be completed. Please try again.');
  const link = document.querySelector('a');
  expect(link.getAttribute('href')).toBe('/pages/0/');
  expect(new URL(link.href).origin).toBe(window.location.origin);
  expect(new URL(link.href).search).toBe('');
  expect(jsutils.KvGet).not.toHaveBeenCalled();
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('mounts an ordinary clean URL and preserves existing sessions', async () => {
  window.history.replaceState({}, '', '/pages/0/?view=compact#intro');
  const mountApplication = vi.fn();
  expect(await bootstrapApplication(mountApplication)).toBe(true);
  expect(mountApplication).toHaveBeenCalledOnce();
  expect(document.querySelector('script[src*="sentry-cdn"]')).not.toBeNull();
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect(jsutils.KvGet).not.toHaveBeenCalled();
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).not.toHaveBeenCalled();
});

test('a rejected but cleaned callback can still mount ordinary articles without a new session', async () => {
  window.history.replaceState({}, '', '/?sso_token=LOCAL_ONLY_CANARY');
  const mountApplication = vi.fn();
  expect(await bootstrapApplication(mountApplication)).toBe(true);
  expect(window.location.search).toBe('');
  expect(mountApplication).toHaveBeenCalledOnce();
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  expect(jsutils.KvSet).not.toHaveBeenCalled();
  expect(jsutils.KvDel).not.toHaveBeenCalled();
});
