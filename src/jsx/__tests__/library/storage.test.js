import jsutils from '@laisky/js-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@laisky/js-utils', () => ({
  default: {
    KvGet: vi.fn(),
    KvSet: vi.fn(),
    KvDel: vi.fn(),
    GetCache: vi.fn(),
    SetCache: vi.fn(),
    KvAddListener: vi.fn(),
    KvRemoveListener: vi.fn(),
    KvOp: { SET: 1, DEL: 2 },
  },
}));

/** never returns a promise that models a store which neither completes nor aborts. */
const never = () => new Promise(() => {});

/** deferred returns a promise with its settlement controls, for a store that answers late. */
const deferred = () => {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

let storage;
let captureMessage;

/** settleWithDeadline advances past the storage deadline and returns the operation's result. */
const settleWithDeadline = async (operation) => {
  const result = operation();
  await vi.advanceTimersByTimeAsync(storage.StorageDeadlineMs);
  return result;
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  vi.useFakeTimers();
  captureMessage = vi.fn();
  window.Sentry = { captureMessage };
  storage = await import('../../library/storage.js');
});

afterEach(() => {
  vi.useRealTimers();
  delete window.Sentry;
});

describe('a healthy store', () => {
  it('passes reads, writes, deletes and caches straight through', async () => {
    jsutils.KvGet.mockResolvedValue('stored');
    jsutils.GetCache.mockResolvedValue('cached');
    await expect(storage.kvGet('key')).resolves.toBe('stored');
    await expect(storage.getCache('key')).resolves.toBe('cached');
    await storage.kvSet('key', 'value');
    await storage.kvDel('key');
    await storage.setCache('key', 'value', 60);
    expect(jsutils.KvSet).toHaveBeenCalledWith('key', 'value');
    expect(jsutils.KvDel).toHaveBeenCalledWith('key');
    expect(jsutils.SetCache).toHaveBeenCalledWith('key', 'value', 60);
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('keeps the default cache lifetime when none is supplied', async () => {
    await storage.setCache('key', 'value');
    expect(jsutils.SetCache).toHaveBeenCalledWith('key', 'value');
  });

  it('does not report or stop using the store after an ordinary rejection', async () => {
    jsutils.KvGet.mockRejectedValueOnce(new Error('transient'));
    jsutils.KvGet.mockResolvedValueOnce('stored');
    await expect(storage.kvGet('key')).resolves.toBeNull();
    await expect(storage.kvGet('key')).resolves.toBe('stored');
    expect(captureMessage).not.toHaveBeenCalled();
  });
});

describe('page memory after a transient failure', () => {
  it('does not let a failed delete hide a value written durably afterwards', async () => {
    jsutils.KvDel.mockRejectedValueOnce(new Error('transient'));
    await storage.kvDel('token');
    await expect(storage.kvGet('token')).resolves.toBeNull();
    jsutils.KvSet.mockResolvedValue(undefined);
    jsutils.KvGet.mockResolvedValue('fresh');
    await storage.kvSetStrict('token', 'fresh');
    await expect(storage.kvGet('token')).resolves.toBe('fresh');
  });
});

describe('a store that never settles', () => {
  beforeEach(() => {
    jsutils.KvGet.mockImplementation(never);
    jsutils.KvSet.mockImplementation(never);
    jsutils.KvDel.mockImplementation(never);
    jsutils.GetCache.mockImplementation(never);
    jsutils.SetCache.mockImplementation(never);
  });

  it('settles every ordinary operation at the deadline', async () => {
    await expect(settleWithDeadline(() => storage.kvGet('key'))).resolves.toBeNull();
  });

  it('fails fast after the first deadline without calling the store again', async () => {
    await settleWithDeadline(() => storage.kvGet('key'));
    jsutils.KvGet.mockClear();
    await expect(storage.kvGet('other')).resolves.toBeNull();
    await expect(storage.getCache('other')).resolves.toBeNull();
    await expect(storage.setCache('other', 'value')).resolves.toBeUndefined();
    expect(jsutils.KvGet).not.toHaveBeenCalled();
    expect(jsutils.GetCache).not.toHaveBeenCalled();
    expect(jsutils.SetCache).not.toHaveBeenCalled();
  });

  it('reports one static warning per page however many operations stall', async () => {
    await settleWithDeadline(() => Promise.all([storage.kvGet('one'), storage.kvGet('two'), storage.getCache('three')]));
    await storage.kvGet('four');
    expect(captureMessage).toHaveBeenCalledOnce();
    const [message, context] = captureMessage.mock.calls[0];
    expect(message).toBe('browser_storage failed (TimeoutError)');
    expect(context.level).toBe('warning');
    expect(JSON.stringify(captureMessage.mock.calls)).not.toMatch(/one|two|three|four/);
  });

  it('holds a written value in page memory and delivers it to listeners', async () => {
    const listener = vi.fn();
    await storage.kvAddListener('language', listener, 'reader');
    await settleWithDeadline(() => storage.kvSet('language', 'zh_CN'));
    expect(listener).toHaveBeenCalledWith('language', jsutils.KvOp.SET, null, 'zh_CN');
    await expect(storage.kvGet('language')).resolves.toBe('zh_CN');
    await storage.kvSet('language', 'en_US');
    expect(listener).toHaveBeenLastCalledWith('language', jsutils.KvOp.SET, 'zh_CN', 'en_US');
  });

  it('stops delivering to a removed listener', async () => {
    const listener = vi.fn();
    await storage.kvAddListener('language', listener, 'reader');
    storage.kvRemoveListener('language', 'reader');
    await settleWithDeadline(() => storage.kvSet('language', 'zh_CN'));
    expect(listener).not.toHaveBeenCalled();
    expect(jsutils.KvRemoveListener).toHaveBeenCalledWith('language', 'reader');
  });

  it('hides a deleted value for this page without touching the store', async () => {
    await settleWithDeadline(() => storage.kvSet('token', 'value'));
    jsutils.KvDel.mockClear();
    await storage.kvDel('token');
    expect(jsutils.KvDel).not.toHaveBeenCalled();
    await expect(storage.kvGet('token')).resolves.toBeNull();
  });

  it('rejects strict operations so durable callers can fail visibly', async () => {
    await expect(settleWithDeadline(() => storage.kvGetStrict('key').catch((error) => error.name))).resolves.toBe('TimeoutError');
    await expect(storage.kvGetStrict('key')).rejects.toMatchObject({ name: 'StorageUnavailableError' });
    await expect(storage.kvSetStrict('key', 'value')).rejects.toMatchObject({ name: 'StorageUnavailableError' });
    await expect(storage.kvDelStrict('key')).rejects.toMatchObject({ name: 'StorageUnavailableError' });
  });
});

describe('a store that is only slow', () => {
  it('uses the store again once a late operation succeeds', async () => {
    const late = deferred();
    jsutils.KvGet.mockReturnValueOnce(late.promise);
    await expect(settleWithDeadline(() => storage.kvGet('key'))).resolves.toBeNull();
    late.resolve('late');
    await vi.advanceTimersByTimeAsync(0);
    jsutils.KvGet.mockResolvedValueOnce('stored');
    await expect(storage.kvGet('key')).resolves.toBe('stored');
  });

  it('prefers a value set during the outage over the recovered store', async () => {
    const late = deferred();
    jsutils.KvSet.mockReturnValueOnce(late.promise);
    await settleWithDeadline(() => storage.kvSet('language', 'zh_CN'));
    late.resolve();
    await vi.advanceTimersByTimeAsync(0);
    jsutils.KvGet.mockResolvedValue('en_US');
    await expect(storage.kvGet('language')).resolves.toBe('zh_CN');
  });
});

describe('listener registration', () => {
  it('keeps the page-memory subscription when the store refuses it', async () => {
    jsutils.KvAddListener.mockRejectedValue(new Error('blocked'));
    jsutils.KvSet.mockRejectedValue(new Error('blocked'));
    const listener = vi.fn();
    await expect(storage.kvAddListener('language', listener, 'reader')).resolves.toBeUndefined();
    await storage.kvSet('language', 'zh_CN');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('leaves delivery to the store while the store is healthy', async () => {
    jsutils.KvSet.mockResolvedValue(undefined);
    const listener = vi.fn();
    await storage.kvAddListener('language', listener, 'reader');
    await storage.kvSet('language', 'zh_CN');
    expect(jsutils.KvAddListener).toHaveBeenCalledWith('language', listener, 'reader');
    expect(listener).not.toHaveBeenCalled();
  });
});
