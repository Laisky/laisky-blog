import jsutils from '@laisky/js-utils';
import { gql } from 'graphql-request';
import { getUserLanguage, graphqlQuery, isForce, KvKeyPrefixCache } from '../library/base.jsx';

export const PAGE_SIZE = 10;
const inFlight = new Map();
const cacheWriters = new Map();
let requestSerial = 0;

/** pageIndex converts a canonical decimal route value to a safe nonnegative index, or null for invalid input. */
export function pageIndex(value = '0') {
  const text = String(value);
  const number = Number(text);
  return /^(0|[1-9]\d*)$/.test(text) && Number.isSafeInteger(number) ? number : null;
}

/** checkCancellation throws a recognizable local cancellation error for an obsolete router request. */
function checkCancellation(request) {
  if (!request?.signal?.aborted) return;
  const error = new Error('Article-list navigation canceled');
  error.name = 'AbortError';
  throw error;
}

/** cachedQuery shares equal public reads while preserving legacy cache keys and separating forced refreshes. */
async function cachedQuery(key, context, read, valid) {
  const flightKey = JSON.stringify([key, context.language, context.force]);
  if (inFlight.has(flightKey)) return inFlight.get(flightKey);
  const serial = ++requestSerial;
  const task = (async () => {
    const cacheKey = KvKeyPrefixCache + (await jsutils.SHA256(key));
    const writers = cacheWriters.get(cacheKey) || { readers: 0, latest: 0 };
    cacheWriters.set(cacheKey, writers);
    writers.readers += 1;
    try {
      if (!context.force) {
        const cached = await jsutils.GetCache(cacheKey);
        if (cached != null && valid(cached)) return cached;
      }
      writers.latest = Math.max(writers.latest, serial);
      const result = await read();
      if (!valid(result)) throw new Error('Invalid article-list response');
      // A slow ordinary read must not overwrite a newer forced refresh.
      if (writers.latest === serial) await jsutils.SetCache(cacheKey, result);
      return result;
    } finally {
      writers.readers -= 1;
      if (writers.readers === 0) cacheWriters.delete(cacheKey);
    }
  })();
  const owned = task.finally(() => {
    inFlight.delete(flightKey);
  });
  inFlight.set(flightKey, owned);
  return owned;
}

/** loadPostInfo returns a validated global post count, including a valid cached zero. */
function loadPostInfo(context) {
  return cachedQuery(
    'loadPostInfo',
    context,
    async () => {
      const response = await graphqlQuery(
        gql`
          query postinfo {
            BlogPostInfo {
              total
            }
          }
        `,
        undefined,
        context.headers
      );
      return response?.BlogPostInfo?.total;
    },
    (value) => Number.isSafeInteger(value) && value >= 0
  );
}

/** loadPage returns one validated list page using a single captured language and the existing cache-key format. */
function loadPage(nPage, context) {
  return cachedQuery(
    `loadPage:${context.language}:${nPage}`,
    context,
    async () => {
      const response = await graphqlQuery(
        gql`
      query ListBlogPosts {
        BlogPosts(language: ${context.language} length: 600 page: { page: ${nPage} size: ${PAGE_SIZE} }) {
          name created_at modified_at type title menu markdown tags
          category { name url }
          arweave_id { id time }
        }
      }
    `,
        undefined,
        context.headers
      );
      return response?.BlogPosts;
    },
    (value) =>
      Array.isArray(value) &&
      value.length <= PAGE_SIZE &&
      value.every((post) => post && typeof post.name === 'string' && typeof post.title === 'string' && typeof post.markdown === 'string')
  );
}

/** loadPageData resolves only a valid foreground page; speculative list and full-article budgets are both zero. */
export async function loadPageData({ params = {}, request } = {}) {
  const nPage = pageIndex(params.nPage);
  const empty = { postsData: [], nPosts: 0, nPage: nPage ?? 0 };
  if (nPage === null) return { ...empty, problem: 'invalid' };
  try {
    checkCancellation(request);
    const language = await getUserLanguage();
    if (!['en_US', 'zh_CN'].includes(language)) throw new Error('Invalid article-list language');
    const force = Boolean(isForce());
    const context = { language, force, headers: force ? { 'Cache-Control': 'no-cache' } : undefined };
    const nPosts = await loadPostInfo(context);
    checkCancellation(request);
    if (nPage >= Math.max(1, Math.ceil(nPosts / PAGE_SIZE))) return { ...empty, nPosts, problem: 'not-found' };
    const postsData = nPosts === 0 ? [] : await loadPage(nPage, context);
    checkCancellation(request);
    return { postsData, nPosts, nPage, language };
  } catch (error) {
    if (request?.signal?.aborted || error?.name === 'AbortError') throw error;
    // The route UI owns this failure. Never return a transport error containing private URLs or bodies.
    return { ...empty, problem: 'request' };
  }
}
