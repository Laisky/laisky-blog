// The backend's fixed refusals for an archive. A database failure uses the first prefix with another cause, so that one
// is matched whole. New wording is reported rather than silenced, which keeps a mismatch visible.
const HistoryDenials = [
  'post history archive is not registered: mongo: no documents in result',
  'post history is not publicly available',
  'post history is not published',
  'validate file id: ',
];

/**
 * isHistoryDenial recognizes the server deciding an archive may not be read, as opposed to failing to answer. It reads
 * only the GraphQL error list and never the error text, which also embeds the request.
 *
 * @param {unknown} error - The failure from loading a historical article.
 * @returns {boolean} True only when every GraphQL error is an expected refusal.
 */
export const isHistoryDenial = (error) => {
  const errors = error?.response?.errors;
  return (
    Array.isArray(errors) &&
    errors.length > 0 &&
    errors.every((entry) => typeof entry?.message === 'string' && HistoryDenials.some((denial) => entry.message.startsWith(denial)))
  );
};
