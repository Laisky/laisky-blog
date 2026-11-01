const ReportedOperations = new Set(['article_list', 'article_load', 'browser_storage', 'language_preferences']);
const ReportedErrorNames = new Set(['Error', 'RangeError', 'SyntaxError', 'TimeoutError', 'TypeError']);

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
 * reportFailure sends one static diagnostic for a failure the page has already handled, so the global Sentry handlers
 * would never see it. It uses a message event because those carry no stack or error text and do not start an on-error replay.
 *
 * @param {string} operation - The allowlisted operation that failed.
 * @param {unknown} error - The failure, used only to choose a static category.
 * @param {'error'|'warning'} [level] - The severity shown in Sentry.
 * @returns {void} No return value.
 */
export const reportFailure = (operation, error, level = 'error') => {
  if (error?.name === 'AbortError' || !ReportedOperations.has(operation)) return;
  const failure = failureType(error);
  try {
    window.Sentry?.captureMessage(`${operation} failed (${failure})`, {
      level,
      tags: { blog_operation: operation, blog_failure: failure },
      fingerprint: ['blog-failure', operation, failure],
    });
  } catch {
    // Reporting is best effort and must never change what the reader sees.
  }
};
