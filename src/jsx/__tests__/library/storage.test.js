import jsutils from '@laisky/js-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@laisky/js-utils', () => ({
  default: {
    KvGet: vi.fn(),
    KvSet: vi.fn(),
    KvDel: vi.fn(),
    GetCache: vi.fn(),
    SetCache: vi.fn(),
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

  it('holds a written value in page memory and tells subscribers once', async () => {
    const subscriber = vi.fn();
    storage.kvSubscribe('language', subscriber);
    await settleWithDeadline(() => storage.kvSet('language', 'zh_CN'));
    await vi.advanceTimersByTimeAsync(0);
    expect(subscriber).toHaveBeenCalledExactlyOnceWith('zh_CN', null);
    await expect(storage.kvGet('language')).resolves.toBe('zh_CN');
    await storage.kvSet('language', 'en_US');
    await vi.advanceTimersByTimeAsync(0);
    expect(subscriber).toHaveBeenLastCalledWith('en_US', 'zh_CN');
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

describe('subscriptions', () => {
  it('delivers a successful write once, with the earlier value', async () => {
    jsutils.KvGet.mockResolvedValue('en_US');
    jsutils.KvSet.mockResolvedValue(undefined);
    const subscriber = vi.fn();
    storage.kvSubscribe('language', subscriber);
    await storage.kvSet('language', 'zh_CN');
    await vi.advanceTimersByTimeAsync(0);
    expect(subscriber).toHaveBeenCalledExactlyOnceWith('zh_CN', 'en_US');
  });

  it('stays silent when a write does not change the value', async () => {
    jsutils.KvGet.mockResolvedValue('en_US');
    jsutils.KvSet.mockResolvedValue(undefined);
    const subscriber = vi.fn();
    storage.kvSubscribe('language', subscriber);
    await storage.kvSet('language', 'en_US');
    await vi.advanceTimersByTimeAsync(0);
    expect(subscriber).not.toHaveBeenCalled();
    expect(jsutils.KvSet).toHaveBeenCalledWith('language', 'en_US');
  });

  it('delivers once when the store answers after the deadline', async () => {
    const late = deferred();
    jsutils.KvSet.mockReturnValueOnce(late.promise);
    jsutils.KvGet.mockResolvedValue(null);
    const subscriber = vi.fn();
    storage.kvSubscribe('language', subscriber);
    await settleWithDeadline(() => storage.kvSet('language', 'zh_CN'));
    late.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(subscriber).toHaveBeenCalledOnce();
  });

  it('removes only the subscription that unsubscribes, even for one shared callback', async () => {
    jsutils.KvSet.mockRejectedValue(new Error('blocked'));
    const shared = vi.fn();
    const unsubscribeFirst = storage.kvSubscribe('language', shared);
    storage.kvSubscribe('language', shared);
    unsubscribeFirst();
    unsubscribeFirst();
    await storage.kvSet('language', 'zh_CN');
    await vi.advanceTimersByTimeAsync(0);
    expect(shared).toHaveBeenCalledOnce();
  });

  it('keeps kvSet resolved and the other subscribers running when one throws', async () => {
    jsutils.KvSet.mockRejectedValue(new Error('blocked'));
    const healthy = vi.fn();
    storage.kvSubscribe('language', () => {
      throw new Error('subscriber');
    });
    storage.kvSubscribe('language', healthy);
    await expect(storage.kvSet('language', 'zh_CN')).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(0);
    expect(healthy).toHaveBeenCalledOnce();
    expect(captureMessage).toHaveBeenCalledOnce();
    expect(captureMessage.mock.calls[0][0]).toBe('storage_subscriber failed (Error)');
  });

  it('owns a rejection from an async subscriber', async () => {
    jsutils.KvSet.mockRejectedValue(new Error('blocked'));
    storage.kvSubscribe('language', async () => {
      throw new TypeError('LOCAL_ONLY_CANARY');
    });
    await storage.kvSet('language', 'zh_CN');
    await vi.advanceTimersByTimeAsync(0);
    expect(captureMessage.mock.calls[0][0]).toBe('storage_subscriber failed (TypeError)');
    expect(JSON.stringify(captureMessage.mock.calls)).not.toContain('LOCAL_ONLY_CANARY');
  });
});

describe('recovery from a stall', () => {
  it('stays closed when an unrelated operation succeeds', async () => {
    const other = deferred();
    jsutils.KvGet.mockImplementationOnce(never);
    const first = storage.kvGet('first');
    await vi.advanceTimersByTimeAsync(storage.StorageDeadlineMs / 2);
    jsutils.KvGet.mockImplementationOnce(() => other.promise);
    const second = storage.kvGet('second');
    await vi.advanceTimersByTimeAsync(storage.StorageDeadlineMs / 2 + 1);
    await first;
    other.resolve('late');
    await second;
    jsutils.KvGet.mockClear();
    await expect(storage.kvGet('third')).resolves.toBeNull();
    expect(jsutils.KvGet).not.toHaveBeenCalled();
  });
});

describe('kvRestore', () => {
  it('reaches a store known to be stalled, because a slow store still applies it', async () => {
    jsutils.KvGet.mockImplementation(never);
    jsutils.KvSet.mockResolvedValue(undefined);
    jsutils.KvDel.mockResolvedValue(undefined);
    await settleWithDeadline(() => storage.kvGet('key'));
    await storage.kvRestore('user', { sub: 'previous' });
    await storage.kvRestore('token', null);
    expect(jsutils.KvSet).toHaveBeenCalledWith('user', { sub: 'previous' });
    expect(jsutils.KvDel).toHaveBeenCalledWith('token');
  });

  it('stays bounded when the store never answers', async () => {
    jsutils.KvSet.mockImplementation(never);
    const outcome = storage.kvRestore('user', 'value').catch((error) => error.name);
    await vi.advanceTimersByTimeAsync(storage.StorageDeadlineMs);
    await expect(outcome).resolves.toBe('TimeoutError');
  });
});
