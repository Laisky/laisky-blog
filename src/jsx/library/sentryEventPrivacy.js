const ErrorTypes = new Set(['Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'TimeoutError']);
const Operations = new Set(['article_list', 'article_load', 'browser_storage', 'language_preferences', 'storage_subscriber']);
const Failures = new Set([...ErrorTypes, 'ClientError', 'Other']);
const Levels = new Set(['fatal', 'error', 'warning', 'info', 'debug', 'log']);

/**
 * safeFrame returns only a frame whose URL is a known build asset, with its source position and no query or fragment.
 *
 * @param {object} frame - The untrusted SDK frame.
 * @param {object} config - The trusted build asset list and origin.
 * @returns {object|null} The sanitized frame, or null for an unrecognized asset.
 */
const safeFrame = (frame, config) => {
  for (const candidate of [frame?.abs_path == null ? frame?.filename : frame.abs_path]) {
    if (typeof candidate !== 'string' || candidate.length > 2048) continue;
    let url;
    try {
      url = new URL(candidate, config.origin);
    } catch {
      continue;
    }
    if (url.origin !== config.origin || url.username || url.password || !config.assets.has(url.pathname)) continue;
    const result = { filename: `${config.origin}${url.pathname}`, abs_path: `${config.origin}${url.pathname}` };
    for (const field of ['lineno', 'colno']) {
      if (Number.isSafeInteger(frame[field]) && frame[field] >= 0 && frame[field] <= 100000000) result[field] = frame[field];
    }
    if (typeof frame.in_app === 'boolean') result.in_app = frame.in_app;
    return result;
  }
  return null;
};

/**
 * sanitizeSentryEvent constructs an error event from allowlisted fields and trusted build configuration.
 *
 * @param {object} event - The SDK error event, whose fields are untrusted.
 * @param {object} config - The validated build identity, environment, origin, and asset set.
 * @returns {object} A new error event with sensitive and unknown fields omitted.
 */
export const sanitizeSentryEvent = (event, config) => {
  const result = { platform: 'javascript', release: config.release, environment: config.environment };
  if (typeof event?.event_id === 'string' && /^[0-9a-f]{32}$/.test(event.event_id)) result.event_id = event.event_id;
  if (typeof event?.timestamp === 'number' && Number.isFinite(event.timestamp)) result.timestamp = event.timestamp;
  if (Levels.has(event?.level)) result.level = event.level;
  const operation = event?.tags?.blog_operation;
  const failure = event?.tags?.blog_failure;
  if ((Operations.has(operation) && Failures.has(failure)) || (operation === 'application_bundle' && failure === 'not_started')) {
    result.message = `${operation} failed (${failure})`;
    result.tags = { blog_operation: operation, blog_failure: failure };
    result.fingerprint = ['blog-failure', operation, failure];
  }
  if (Array.isArray(event?.exception?.values)) {
    result.exception = {
      values: event.exception.values.slice(0, 10).map((exception) => {
        const clean = { type: ErrorTypes.has(exception?.type) ? exception.type : 'Error' };
        if (typeof exception?.mechanism?.handled === 'boolean') {
          clean.mechanism = { type: 'generic', handled: exception.mechanism.handled };
        }
        if (Array.isArray(exception?.stacktrace?.frames)) {
          const frames = exception.stacktrace.frames
            .slice(-100)
            .map((frame) => safeFrame(frame, config))
            .filter(Boolean);
          if (frames.length) clean.stacktrace = { frames };
        }
        return clean;
      }),
    };
  }
  return result;
};

/**
 * createOfflineSentryAdapter validates explicit local configuration and builds an opt-in loader callback.
 * This covers error events processed by beforeSend only, not transactions, replays, sessions or attachments.
 *
 * @param {object} input - Trusted commit SHA, manifest digest, environment, origin and generated asset paths.
 * @returns {Function} A callback for assignment to window.sentryOnLoad before adding the loader.
 */
export const createOfflineSentryAdapter = (input) => {
  if (
    !/^[0-9a-f]{40}$/.test(input?.commit || '') ||
    !/^[0-9a-f]{64}$/.test(input?.build || '') ||
    !['production', 'staging', 'development'].includes(input?.environment)
  ) {
    throw new Error('Invalid build identity or environment');
  }
  let origin;
  try {
    const url = new URL(input.origin);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Invalid origin');
    }
    origin = url.origin;
  } catch {
    throw new Error('Invalid origin');
  }
  if (
    !Array.isArray(input.assets) ||
    input.assets.length === 0 ||
    input.assets.length > 10000 ||
    input.assets.some((asset) => typeof asset !== 'string' || !/^\/assets\/[A-Za-z0-9_.-]+\.js$/.test(asset))
  ) {
    throw new Error('Invalid build asset list');
  }
  const config = {
    release: `blog@${input.commit}+sha256.${input.build}`,
    environment: input.environment,
    origin,
    assets: new Set(input.assets),
  };
  return (sentry) => {
    sentry.init({
      release: config.release,
      environment: config.environment,
      sendDefaultPii: false,
      beforeSend: (event) => sanitizeSentryEvent(event, config),
    });
  };
};

/**
 * installOfflineSentryAdapter installs an opt-in loader callback before a caller adds the CDN script.
 *
 * @param {object} target - The window-like object that will receive the loader and SDK.
 * @param {object} input - The trusted configuration accepted by createOfflineSentryAdapter.
 * @returns {void} No return value.
 */
export const installOfflineSentryAdapter = (target, input) => {
  const initialize = createOfflineSentryAdapter(input);
  if (target.sentryOnLoad) throw new Error('Sentry loader callback already installed');
  target.sentryOnLoad = () => initialize(target.Sentry);
};
