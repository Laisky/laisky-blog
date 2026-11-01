import jsutils from '@laisky/js-utils';
import { runAsyncWork } from './asyncWork.js';
import { reportFailure } from './failureReport.js';

/** StorageDeadlineMs bounds one browser-storage operation so an unusable database cannot delay reading for long. */
export const StorageDeadlineMs = 2000;

const memory = new Map();
const subscribers = new Map();
const recoverySubscribers = new Set();
const writeCounts = new Map();
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
 * notifyRecovery tells subscribers that a timed-out operation has finished, so what they read earlier may be out of date.
 *
 * @returns {void} No return value.
 */
const notifyRecovery = () => {
  recoverySubscribers.forEach((callback) => {
    Promise.resolve()
      .then(callback)
      .catch((error) => reportFailure('storage_subscriber', error));
  });
};

/**
 * beginWrite records a new write to a key, so an overlapping older write can tell it has been superseded.
 *
 * @param {string} key - The key being written.
 * @returns {function(): boolean} Reports whether this is still the newest write to the key.
 */
const beginWrite = (key) => {
  const count = (writeCounts.get(key) ?? 0) + 1;
  writeCounts.set(key, count);
  return () => writeCounts.get(key) === count;
};

/**
 * bounded runs one storage operation under the shared deadline. PouchDB has no timeout of its own: in WebKit private
 * sessions its setup transaction neither completes nor aborts, so an unbounded call would never settle.
 *
 * @param {function(): Promise<*>} start - The operation to run.
 * @param {{force?: boolean, onLateSuccess?: function(): Promise<*>}} [options] - Set force to run the operation even when
 *   the store is known to be stalled. onLateSuccess runs if the operation succeeds after its deadline has already failed it.
 * @returns {Promise<*>} The operation result, or a rejection on failure, deadline, or a known stalled store.
 */
const bounded = (start, { force = false, onLateSuccess } = {}) => {
  if (stalled && !force) return Promise.reject(unavailableError());
  const work = Promise.resolve().then(start);
  let timedOut = false;
  // Only the timed-out operation's own late success proves the store is slow rather than unusable.
  work.then(
    () => {
      if (!timedOut) return;
      stalled = false;
      // Readers hear about recovery only after any undo has run, so they never see the state it replaces.
      Promise.resolve()
        .then(onLateSuccess)
        .catch((error) => reportFailure('storage_subscriber', error))
        .finally(notifyRecovery);
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
 * @param {{onLateSuccess?: function(): Promise<*>}} [options] - onLateSuccess undoes a write that commits after this call
 *   has already rejected at the deadline.
 * @returns {Promise<void>} Resolves after the write.
 */
export const kvSetStrict = async (key, value, options) => {
  const isLatest = beginWrite(key);
  await bounded(() => jsutils.KvSet(key, value), options);
  if (isLatest()) memory.delete(key);
};

/**
 * kvDelStrict removes a value and rejects when storage is unusable.
 *
 * @param {string} key - The key to remove.
 * @param {{force?: boolean}} [options] - Set force to attempt the removal even when the store is known to be stalled.
 * @returns {Promise<void>} Resolves after the removal.
 */
export const kvDelStrict = async (key, options) => {
  await bounded(() => jsutils.KvDel(key), options);
  memory.delete(key);
};

/**
 * kvRestore puts back a value captured before a write failed. It runs even when the store is known to be stalled,
 * because a write that timed out can still commit, and a skipped rollback would then leave the failed value in place.
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
 * kvReplaceIfUnchanged replaces a value only if it still equals what the caller last saw, so cleanup cannot destroy a
 * value written since. js-utils has no atomic compare, so the check and the write are separate store calls, which
 * shrinks the race to one store round trip. It runs even when the store is known to be stalled.
 *
 * @param {string} key - The key to change.
 * @param {*} expected - The value the caller last saw.
 * @param {*} replacement - The new value; null or undefined removes the key.
 * @returns {Promise<boolean>} True when the value was replaced, and false when it had changed.
 */
export const kvReplaceIfUnchanged = async (key, expected, replacement) => {
  const current = await bounded(() => jsutils.KvGet(key), { force: true });
  if ((current ?? null) !== (expected ?? null)) return false;
  await kvRestore(key, replacement);
  return true;
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
  const isLatest = beginWrite(key);
  const previous = await kvGet(key);
  try {
    await bounded(() => jsutils.KvSet(key, value));
    if (isLatest()) memory.delete(key);
  } catch {
    if (isLatest()) memory.set(key, value);
  }
  // An overlapping newer write owns the outcome, so this one must not report a value that has been replaced.
  if (isLatest() && previous !== value) notifySubscribers(key, value, previous);
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

/**
 * kvSubscribeRecovery watches for a timed-out operation finishing late. That operation may have changed stored data or
 * ended an outage, so anything derived from an earlier read should be read again.
 *
 * @param {function(): (void|Promise<void>)} callback - Runs after each late finish.
 * @returns {function(): void} Removes this subscription and no other.
 */
export const kvSubscribeRecovery = (callback) => {
  const subscription = () => callback();
  recoverySubscribers.add(subscription);
  return () => {
    recoverySubscribers.delete(subscription);
  };
};
