import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAsyncWork } from '../../library/asyncWork.js';
import { loadOptionalScript } from '../../library/optionalScripts.js';

beforeEach(() => {
  document.head.querySelectorAll('script').forEach((script) => script.remove());
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.head.querySelectorAll('script').forEach((script) => script.remove());
});

describe('bounded asynchronous ownership', () => {
  it('cleans the deadline after a success or a synchronous failure', async () => {
    await expect(runAsyncWork(() => 42)).resolves.toBe(42);
    await expect(
      runAsyncWork(() => {
        throw new Error('failed');
      })
    ).rejects.toThrow('failed');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not start canceled work', async () => {
    const controller = new globalThis.AbortController();
    controller.abort();
    const start = vi.fn();
    await expect(runAsyncWork(start, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(start).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('owns a pending request timeout and consumes its late rejection', async () => {
    let rejectLate;
    const work = runAsyncWork(
      () =>
        new Promise((_resolve, reject) => {
          rejectLate = reject;
        }),
      { timeoutMs: 10 }
    );
    const assertion = expect(work).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    rejectLate(new Error('late request error'));
    await Promise.resolve();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels only the consumer and removes its listener', async () => {
    const controller = new globalThis.AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const work = runAsyncWork(() => new Promise(() => {}), { signal: controller.signal });
    const assertion = expect(work).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    controller.abort();
    await assertion;
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([0, -1, Infinity, NaN, 60001])('rejects invalid deadline %s', async (timeoutMs) => {
    await expect(runAsyncWork(() => true, { timeoutMs })).rejects.toThrow('Invalid operation deadline');
  });
});

describe('safe optional-script identity', () => {
  it.each(['analytics', 'search'])('replaces a raw DOM event for %s without retaining request data', async (feature) => {
    const work = loadOptionalScript(feature);
    await Promise.resolve();
    const script = document.head.querySelector('script');
    script.src = 'https://fixture.invalid/?token=secret-canary';
    const event = new globalThis.Event('error');
    Object.defineProperty(event, 'target', { value: script });
    script.dispatchEvent(event);
    let failure;
    try {
      await work;
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ name: 'OptionalFeatureError', feature, stage: 'load' });
    expect(failure.cause).toBeUndefined();
    expect(JSON.stringify(failure) + failure.message + failure.stack).not.toMatch(/secret-canary|fixture.invalid/);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('identifies a timeout separately from a load rejection', async () => {
    const assertion = expect(loadOptionalScript('search', { timeoutMs: 10 })).rejects.toMatchObject({
      feature: 'search',
      stage: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });
  it('identifies legitimate consumer cancellation without requesting a script', async () => {
    const controller = new globalThis.AbortController();
    controller.abort();
    await expect(loadOptionalScript('search', { signal: controller.signal })).rejects.toMatchObject({ stage: 'canceled' });
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });
  it.each(['unknown', 'toString', '__proto__'])('rejects unapproved feature %s without a request', async (feature) => {
    await expect(loadOptionalScript(feature)).rejects.toThrow('Unknown optional feature');
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });
});
