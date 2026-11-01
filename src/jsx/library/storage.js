import jsutils from '@laisky/js-utils';
import { runAsyncWork } from './asyncWork.js';
import { reportFailure } from './failureReport.js';

/** StorageDeadlineMs bounds one browser-storage operation so an unusable database cannot delay reading for long. */
export const StorageDeadlineMs = 2000;

const memory = new Map();
const listeners = new Map();
let stalled = false;
let stallReported = false;

/**
 * unavailableError creates the rejection used once storage has been found to be stalled.
 *
 * @returns {Error} A named error containing no key or value.
 */
const unavailableError = () => {
  const error = new Error('Browser storage is unavailable');
  error.name = 'StorageUnavailableError';
  return error;
};

/**
 * markStalled makes later operations fail fast and reports the degradation once per page.
 *
 * @param {Error} error - The deadline failure.
 * @returns {void} No return value.
 */
const markStalled = (error) => {
  stalled = true;
  if (stallReported) return;
  stallReported = true;
  reportFailure('browser_storage', error, 'warning');
};

/**
 * bounded runs one storage operation under the shared deadline. PouchDB has no timeout of its own: in WebKit private
 * sessions its setup transaction neither completes nor aborts, so an unbounded call would never settle.
 *
 * @param {function(): Promise<*>} start - The operation to run.
 * @returns {Promise<*>} The operation result, or a rejection on failure, deadline, or a known stalled store.
 */
const bounded = (start) => {
  if (stalled) return Promise.reject(unavailableError());
  const work = Promise.resolve().then(start);
  // A late success proves the store is slow rather than unusable, so later calls may use it again.
  work.then(
    () => {
      stalled = false;
    },
    () => {}
  );
  return runAsyncWork(() => work, { timeoutMs: StorageDeadlineMs }).catch((error) => {
    if (error?.name === 'TimeoutError') markStalled(error);
    throw error;
  });
};

/**
 * notifyListeners delivers a change that only reached page memory, because the store never saw it to notify anyone.
 *
 * @param {string} key - The changed key.
 * @param {*} previous - The earlier page-memory value.
 * @param {*} value - The new value.
 * @returns {void} No return value.
 */
const notifyListeners = (key, previous, value) => {
  listeners.get(key)?.forEach((callback) => callback(key, jsutils.KvOp?.SET, previous, value));
};

/**
 * kvGetStrict reads a stored value and rejects when storage is unusable, for callers that must not treat that as absent.
 *
 * @param {string} key - The key to read.
 * @returns {Promise<*>} The stored value, or null when the key does not exist.
 */
export const kvGetStrict = (key) => bounded(() => jsutils.KvGet(key));

/**
 * kvSetStrict writes a value and rejects when storage is unusable, for callers that need durable persistence.
 *
 * @param {string} key - The key to write.
 * @param {*} value - The value to store.
 * @returns {Promise<void>} Resolves after the write.
 */
export const kvSetStrict = async (key, value) => {
  await bounded(() => jsutils.KvSet(key, value));
  memory.delete(key);
};

/**
 * kvDelStrict removes a value and rejects when storage is unusable.
 *
 * @param {string} key - The key to remove.
 * @returns {Promise<void>} Resolves after the removal.
 */
export const kvDelStrict = async (key) => {
  await bounded(() => jsutils.KvDel(key));
  memory.delete(key);
};

/**
 * kvGet reads a value for ordinary page work, preferring anything recorded in page memory during an outage.
 *
 * @param {string} key - The key to read.
 * @returns {Promise<*>} The value, or null when it is absent or storage is unusable.
 */
export const kvGet = async (key) => {
  if (memory.has(key)) return memory.get(key);
  try {
    return await kvGetStrict(key);
  } catch {
    return null;
  }
};

/**
 * kvSet writes a value and falls back to page memory, so a reader's choice still applies until the page is closed.
 *
 * @param {string} key - The key to write.
 * @param {*} value - The value to store.
 * @returns {Promise<void>} Resolves after the value is stored or held in memory; it never rejects.
 */
export const kvSet = async (key, value) => {
  try {
    await kvSetStrict(key, value);
  } catch {
    const previous = memory.get(key) ?? null;
    memory.set(key, value);
    notifyListeners(key, previous, value);
  }
};

/**
 * kvDel removes a value. During an outage it hides the value for this page and leaves the store untouched, so a value
 * that merely could not be read is never destroyed.
 *
 * @param {string} key - The key to remove.
 * @returns {Promise<void>} Resolves after the removal or memory update; it never rejects.
 */
export const kvDel = async (key) => {
  try {
    await kvDelStrict(key);
  } catch {
    memory.set(key, null);
  }
};

/**
 * getCache reads a cached response, treating unusable storage as a cache miss.
 *
 * @param {string} key - The cache key.
 * @returns {Promise<*>} The cached value, or null on a miss.
 */
export const getCache = async (key) => {
  try {
    return await bounded(() => jsutils.GetCache(key));
  } catch {
    return null;
  }
};

/**
 * setCache writes a cached response on a best-effort basis.
 *
 * @param {string} key - The cache key.
 * @param {*} value - The value to cache.
 * @param {number} [ttl] - The optional lifetime forwarded to the cache.
 * @returns {Promise<void>} Resolves whether or not the write succeeded; it never rejects.
 */
export const setCache = async (key, value, ttl) => {
  try {
    await bounded(() => (ttl === undefined ? jsutils.SetCache(key, value) : jsutils.SetCache(key, value, ttl)));
  } catch {
    // A cache write is an optimization, so the page continues without it.
  }
};

/**
 * kvAddListener subscribes to a key's changes from both the store and page memory.
 *
 * @param {string} key - The key to watch.
 * @param {function(string, *, *, *): void} callback - Receives the key, operation, previous value, and new value.
 * @param {string} name - The stable subscription name.
 * @returns {Promise<void>} Resolves after subscribing; a store failure leaves the page-memory subscription active.
 */
export const kvAddListener = async (key, callback, name) => {
  if (!listeners.has(key)) listeners.set(key, new Map());
  listeners.get(key).set(name, callback);
  try {
    await jsutils.KvAddListener(key, callback, name);
  } catch {
    // Page memory still delivers changes while the store is unusable.
  }
};

/**
 * kvRemoveListener removes a named subscription from both the store and page memory.
 *
 * @param {string} key - The watched key.
 * @param {string} name - The subscription name.
 * @returns {void} No return value.
 */
export const kvRemoveListener = (key, name) => {
  listeners.get(key)?.delete(name);
  jsutils.KvRemoveListener?.(key, name);
};
