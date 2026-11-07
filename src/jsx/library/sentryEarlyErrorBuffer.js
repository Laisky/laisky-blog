const ErrorTypes = new Set(['Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError']);
const MaxEarlyErrors = 8;

/**
 * installEarlyErrorBuffer records bounded static error details until a clean-page caller starts the SDK.
 * The caller must establish callback cleanup before passing cleanUrl and must stop before SDK initialization.
 *
 * @param {Window} target - The window whose early error events are observed.
 * @param {object} input - A clean URL assertion, trusted origin, and exact built asset paths.
 * @returns {object} Stop and one-shot flush operations for the buffered events.
 */
export const installEarlyErrorBuffer = (target, input) => {
  if (input?.cleanUrl !== true || typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') {
    throw new Error('A clean callback-free URL is required');
  }
  let origin;
  try {
    const url = new URL(input.origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Invalid origin');
    }
    origin = url.origin;
  } catch {
    throw new Error('Invalid origin');
  }
  if (
    !Array.isArray(input.assets) ||
    !input.assets.length ||
    input.assets.length > 10000 ||
    input.assets.some((asset) => typeof asset !== 'string' || !/^\/assets\/[A-Za-z0-9_.-]+\.js$/.test(asset))
  ) {
    throw new Error('Invalid asset list');
  }
  const assets = new Set(input.assets);
  const pending = [];
  const seen = new Set();
  let stopped = false;
  let flushed = false;

  /**
   * onError captures only a trusted asset location and static error type from an untrusted browser event.
   *
   * @param {ErrorEvent} event - The early browser error event.
   * @returns {void} No return value.
   */
  const onError = (event) => {
    try {
      if (pending.length >= MaxEarlyErrors || typeof event?.filename !== 'string' || event.filename.length > 2048) return;
      const url = new URL(event.filename, origin);
      if (url.origin !== origin || url.username || url.password || !assets.has(url.pathname)) return;
      if (!Number.isSafeInteger(event.lineno) || event.lineno < 1 || event.lineno > 100000000) return;
      if (!Number.isSafeInteger(event.colno) || event.colno < 0 || event.colno > 100000000) return;
      const name = ErrorTypes.has(event.error?.name) ? event.error.name : 'Error';
      const filename = `${origin}${url.pathname}`;
      const key = `${name}:${filename}:${event.lineno}:${event.colno}`;
      if (seen.has(key)) return;
      seen.add(key);
      pending.push({ type: name, filename, lineno: event.lineno, colno: event.colno });
    } catch {
      // A hostile browser event must not disrupt page startup.
    }
  };
  target.addEventListener('error', onError);

  return {
    /** stop removes the early listener before the SDK installs its own global handler. */
    stop: () => {
      if (!stopped) target.removeEventListener('error', onError);
      stopped = true;
    },
    /** flush sends each retained static event once after stop and SDK initialization. */
    flush: (sentry) => {
      if (!stopped) throw new Error('Stop the early listener before flushing');
      if (flushed) return 0;
      if (typeof sentry?.captureEvent !== 'function') throw new Error('SDK captureEvent is unavailable');
      flushed = true;
      const reports = pending.splice(0);
      let sent = 0;
      reports.forEach(({ type, filename, lineno, colno }) => {
        try {
          sentry.captureEvent({
            level: 'error',
            exception: { values: [{ type, stacktrace: { frames: [{ filename, abs_path: filename, lineno, colno, in_app: true }] } }] },
          });
          sent += 1;
        } catch {
          // A reporting failure must not prevent page startup or later reports.
        }
      });
      return sent;
    },
  };
};
