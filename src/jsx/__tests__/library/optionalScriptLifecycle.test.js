import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadOptionalScript } from '../../library/optionalScripts.js';

// Mirror the locked utility's DOM behavior; its package entry cannot execute in Vitest's Node resolver.
// Real bundled behavior is independently checked by the built-browser slow-script controls.
vi.mock('@laisky/js-utils', () => ({
  default: {
    LoadJsModules: async (urls) =>
      Promise.all(
        urls.map(
          (url) =>
            new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = url;
              script.async = false;
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
            })
        )
      ),
  },
}));

/** startScript begins one real DOM load and flushes its deferred creation without live network access. */
async function startScript(feature, options) {
  const work = loadOptionalScript(feature, options);
  work.catch(() => {});
  await Promise.resolve();
  return { work, script: document.head.querySelector('script:last-of-type') };
}

beforeEach(() => {
  vi.useFakeTimers();
  document.head.querySelectorAll('script').forEach((script) => script.remove());
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.head.querySelectorAll('script').forEach((script) => script.remove());
});

describe('independent optional script DOM lifecycle', () => {
  it.each(['analytics', 'search'])('loads %s without joining the ordered-script queue', async (feature) => {
    const { work, script } = await startScript(feature);
    expect(script.async).toBe(true);
    script.dispatchEvent(new globalThis.Event('load'));
    await work;
    expect(script.onload).toBeNull();
    expect(script.onerror).toBeNull();
    expect(script.isConnected).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('removes a canceled consumer script and detaches both handlers', async () => {
    const controller = new globalThis.AbortController();
    const { work, script } = await startScript('search', { signal: controller.signal });
    controller.abort();
    await expect(work).rejects.toMatchObject({ stage: 'canceled' });
    expect(script.isConnected).toBe(false);
    expect(script.onload).toBeNull();
    expect(script.onerror).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retires a timed-out attempt before a fresh user retry', async () => {
    const { work, script } = await startScript('search', { timeoutMs: 10 });
    const assertion = expect(work).rejects.toMatchObject({ stage: 'timeout' });
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(script.isConnected).toBe(false);
    expect(script.onload).toBeNull();
    expect(script.onerror).toBeNull();
    const retry = await startScript('search');
    expect(retry.script).not.toBe(script);
    expect(document.head.querySelectorAll('script')).toHaveLength(1);
    retry.script.dispatchEvent(new globalThis.Event('load'));
    await retry.work;
  });

  it('owns raw DOM error events with no retained target or failed URL', async () => {
    const { work, script } = await startScript('search');
    script.src = 'https://fixture.invalid/?token=secret-canary';
    script.dispatchEvent(new globalThis.Event('error'));
    const failure = await work.catch((error) => error);
    expect(failure).toMatchObject({ name: 'OptionalFeatureError', feature: 'search', stage: 'load' });
    expect(failure.cause).toBeUndefined();
    expect(JSON.stringify(failure) + failure.message + failure.stack).not.toMatch(/secret-canary|fixture.invalid/);
    expect(script.isConnected).toBe(false);
    expect(script.onload).toBeNull();
    expect(script.onerror).toBeNull();
  });

  it('does not insert a script for an already canceled consumer', async () => {
    const controller = new globalThis.AbortController();
    controller.abort();
    const { work } = await startScript('analytics', { signal: controller.signal });
    await expect(work).rejects.toMatchObject({ stage: 'canceled' });
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });

  it('owns each feature without a failure removing the other script', async () => {
    const analytics = await startScript('analytics');
    const search = await startScript('search');
    analytics.script.dispatchEvent(new globalThis.Event('error'));
    await expect(analytics.work).rejects.toMatchObject({ feature: 'analytics' });
    expect(search.script.isConnected).toBe(true);
    search.script.dispatchEvent(new globalThis.Event('load'));
    await search.work;
    expect(document.head.querySelectorAll('script')).toHaveLength(1);
  });
});
