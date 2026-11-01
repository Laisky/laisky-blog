import jsutils from '@laisky/js-utils';
import { runAsyncWork } from './asyncWork.js';
import { reportFailure } from './failureReport.js';

/** StorageDeadlineMs bounds one browser-storage operation so an unusable database cannot delay reading for long. */
export const StorageDeadlineMs = 2000;

const memory = new Map();
const subscribers = new Map();
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
 * @param {{force?: boolean}} [options] - Set force to run the operation even when the store is known to be stalled.
 * @returns {Promise<*>} The operation result, or a rejection on failure, deadline, or a known stalled store.
 */
const bounded = (start, { force = false } = {}) => {
  if (stalled && !force) return Promise.reject(unavailableError());
  const work = Promise.resolve().then(start);
  let timedOut = false;
  // Only the timed-out operation's own late success proves the store is slow rather than unusable.
  work.then(
    () => {
      if (timedOut) stalled = false;
    },
    () => {}
  );
  return runAsyncWork(() => work, { timeoutMs: StorageDeadlineMs }).catch((error) => {
    if (error?.name === 'TimeoutError') {
      timedOut = true;
      markStalled(error);
    }
    throw error;
  });
};

/**
 * notifySubscribers delivers one change. Each subscriber runs in isolation, so its failure cannot reach the writer or
 * the other subscribers.
 *
 * @param {string} key - The changed key.
 * @param {*} value - The new value.
 * @param {*} previous - The earlier value.
 * @returns {void} No return value.
 */
const notifySubscribers = (key, value, previous) => {
  subscribers.get(key)?.forEach((callback) => {
    Promise.resolve()
      .then(() => callback(value, previous))
      .catch((error) => reportFailure('storage_subscriber', error));
  });
};

/**
 * kvGetStrict reads a value and rejects when storage is unusable, for callers that must not treat that as absent.
 *
 * @param {string} key - The key to read.
 * @returns {Promise<*>} The value held for this page or stored, or null when the key does not exist.
 */
export const kvGetStrict = async (key) => (memory.has(key) ? memory.get(key) : bounded(() => jsutils.KvGet(key)));

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
 * kvRestore puts back a value captured before a multi-key write failed. It runs even when the store is known to be
 * stalled, because a rollback skipped after a timeout would leave the keys inconsistent once a slow store catches up.
 *
 * @param {string} key - The key to restore.
 * @param {*} previous - The earlier value; null or undefined removes the key.
 * @returns {Promise<void>} Resolves after the restore, and rejects on failure or at the deadline.
 */
export const kvRestore = async (key, previous) => {
  await bounded(() => (previous == null ? jsutils.KvDel(key) : jsutils.KvSet(key, previous)), { force: true });
  memory.delete(key);
};

/**
 * kvGet reads a value for ordinary page work, preferring anything recorded in page memory during an outage.
 *
 * @param {string} key - The key to read.
 * @returns {Promise<*>} The value, or null when it is absent or storage is unusable.
 */
export const kvGet = async (key) => {
  try {
    return await kvGetStrict(key);
  } catch {
    return null;
  }
};

/**
 * kvSet writes a value and falls back to page memory, so a reader's choice still applies until the page is closed.
 * It is the only source of change notifications, so subscribers hear each change once however the write ends.
 *
 * @param {string} key - The key to write.
 * @param {*} value - The value to store.
 * @returns {Promise<void>} Resolves after the value is stored or held in memory; it never rejects.
 */
export const kvSet = async (key, value) => {
  const previous = await kvGet(key);
  try {
    await kvSetStrict(key, value);
  } catch {
    memory.set(key, value);
  }
  if (previous !== value) notifySubscribers(key, value, previous);
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
 * kvSubscribe watches a key for changes made through kvSet. Registration does no storage work, so it cannot fail or wait.
 *
 * @param {string} key - The key to watch.
 * @param {function(*, *): (void|Promise<void>)} callback - Receives the new and previous values.
 * @returns {function(): void} Removes this subscription and no other.
 */
export const kvSubscribe = (key, callback) => {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  const keySubscribers = subscribers.get(key);
  const subscription = (value, previous) => callback(value, previous);
  keySubscribers.add(subscription);
  return () => {
    keySubscribers.delete(subscription);
  };
};
