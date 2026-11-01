const ReportedOperations = new Set(['article_list', 'article_load', 'browser_storage', 'language_preferences', 'storage_subscriber']);
const ReportedErrorNames = new Set(['Error', 'RangeError', 'SyntaxError', 'TimeoutError', 'TypeError']);
const TelemetryScriptSelector = 'script[src*="js.sentry-cdn.com"]';
const MaxPendingReports = 8;
const pendingReports = [];

/**
 * failureType reduces an error to a static label without reading its message, which may embed requests or responses.
 *
 * @param {unknown} error - The failure that reached the owning boundary.
 * @returns {string} An allowlisted error category.
 */
const failureType = (error) => {
  if (error?.response) return 'ClientError';
  return ReportedErrorNames.has(error?.name) ? error.name : 'Other';
};

/**
 * deliverPendingReports sends reports that were held until the SDK loaded.
 *
 * @returns {void} No return value.
 */
export const deliverPendingReports = () => {
  try {
    if (!window.Sentry?.captureMessage) return;
    pendingReports.splice(0).forEach(([message, context]) => window.Sentry.captureMessage(message, context));
  } catch {
    // Reporting is best effort and must never change what the reader sees.
  }
};

/**
 * reportFailure sends one static diagnostic for a failure the page has already handled, so the global Sentry handlers
 * would never see it. It uses a message event because those carry no stack or error text and do not start an on-error replay.
 *
 * @param {string} operation - The allowlisted operation that failed.
 * @param {unknown} error - The failure, used only to choose a static category.
 * @param {'error'|'warning'} [level] - The severity shown in Sentry.
 * @returns {void} No return value.
 */
export const reportFailure = (operation, error, level = 'error') => {
  try {
    if (error?.name === 'AbortError' || !ReportedOperations.has(operation)) return;
    const failure = failureType(error);
    const report = [
      `${operation} failed (${failure})`,
      { level, tags: { blog_operation: operation, blog_failure: failure }, fingerprint: ['blog-failure', operation, failure] },
    ];
    if (window.Sentry?.captureMessage) {
      window.Sentry.captureMessage(...report);
    } else if (pendingReports.length < MaxPendingReports) {
      // A failure can beat the async SDK loader, so hold this bounded static report until it arrives.
      pendingReports.push(report);
      document.querySelector(TelemetryScriptSelector)?.addEventListener('load', deliverPendingReports, { once: true });
    }
  } catch {
    // Reporting is best effort and must never change what the reader sees.
  }
};
