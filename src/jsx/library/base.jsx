'use strict';

import { GraphQLClient } from 'graphql-request';
import { kvGet, kvSet } from './storage.js';

export { getCurrentUsername, isJwtExpired, KvKeyAuthUser, KvKeyUserToken, requireUserToken } from './session.js';

export const GraphqlAPI = 'https://gq_v2.laisky.com/query/';

export const KvKeyLanguage = 'language';
export const KvKeyPrefixCache = '@cache_';

export const DurationDay = 24 * 60 * 60 * 1000;
export const DurationWeek = 7 * DurationDay;

const GraphqlJsonContentTypes = ['application/graphql-response+json', 'application/json'];

/**
 * isGraphqlJsonContentType checks whether a Content-Type header is parseable as GraphQL JSON.
 *
 * @param {string|null} contentType - The response Content-Type header value.
 * @returns {boolean} True when the content type is a GraphQL JSON content type.
 */
export const isGraphqlJsonContentType = (contentType) => {
  if (!contentType) {
    return false;
  }

  const normalizedContentType = contentType.toLowerCase();
  return GraphqlJsonContentTypes.some((expectedContentType) => normalizedContentType.includes(expectedContentType));
};

/**
 * isJsonExecutionResult checks whether text can be parsed as a GraphQL execution result.
 *
 * @param {string} text - The response body text to inspect.
 * @returns {boolean} True when the text parses to an object or array.
 */
export const isJsonExecutionResult = (text) => {
  try {
    const result = JSON.parse(text);
    return Array.isArray(result) || (typeof result === 'object' && result !== null);
  } catch {
    return false;
  }
};

/**
 * normalizeGraphqlResponseContentType fixes GraphQL JSON responses with incorrect content types.
 *
 * @param {Response} response - The fetch response to normalize.
 * @returns {Promise<Response>} A response with a JSON content type when the body is a JSON execution result.
 */
export const normalizeGraphqlResponseContentType = async (response) => {
  if (isGraphqlJsonContentType(response.headers.get('Content-Type'))) {
    return response;
  }

  const text = await response.clone().text();
  if (!isJsonExecutionResult(text)) {
    return response;
  }

  const headers = new globalThis.Headers(response.headers);
  headers.set('Content-Type', 'application/json');

  return new globalThis.Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

/**
 * graphqlFetch fetches GraphQL responses and normalizes mislabeled JSON bodies.
 *
 * @param {RequestInfo|URL} input - The fetch resource.
 * @param {RequestInit} init - The fetch options.
 * @returns {Promise<Response>} The normalized fetch response.
 */
export const graphqlFetch = async (input, init) => {
  const response = await globalThis.fetch(input, init);
  return normalizeGraphqlResponseContentType(response);
};

/**
 * Get the current user token.
 *
 * @param {string} body - The graphql query body.
 * @param {object} vars - The graphql query variables.
 * @param {object} headers - The graphql query headers.
 *
 */
export const graphqlQuery = async (body, vars, headers) => {
  const client = new GraphQLClient(getGraphqlAPI(), {
    method: 'GET',
    fetch: graphqlFetch,
  });

  if (isForce()) {
    // disable cache
    headers = headers || {};
    headers['Cache-Control'] = 'no-cache';
  }

  return await client.request(body, vars, headers);
};

/**
 * Get the current user token.
 *
 * @param {string} body - The graphql mutation body.
 * @param {object} vars - The graphql mutation variables.
 * @param {object} headers - The graphql mutation headers.
 */
export const graphqlMutation = async (body, vars, headers) => {
  const client = new GraphQLClient(getGraphqlAPI(), {
    fetch: graphqlFetch,
  });

  return await client.request(body, vars, headers);
};

/**
 * Check is bypass all cache
 */
export const isForce = () => {
  if (typeof window !== 'undefined' && window.location) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('force');
  }

  return false;
};

export const getGraphqlAPI = () => {
  if (isForce()) {
    return `${GraphqlAPI}?force=1`;
  }

  return GraphqlAPI;
};

export const getCurrentPathName = () => {
  return location.pathname;
};

/**
 * Set the user language.
 *
 * @param {string} lang - The user language.
 */
export const setUserLanguage = async (lang) => {
  await kvSet(KvKeyLanguage, lang);
};

/**
 * Get the current user language.
 * The "zh" language subtag and its variants, such as "zh-Hant-TW" or "zh_CN", select Chinese. Anything else, including
 * an unknown language or a malformed stored value, falls back to English.
 *
 * @returns {string} The normalized user language code (either "zh_CN" or "en_US")
 */
export const getUserLanguage = async () => {
  // Get language from the URL parameter, kv storage, or browser settings in that order
  const url = new URL(window.location.href);
  const lang = url.searchParams.get('lang') || (await kvGet(KvKeyLanguage)) || navigator.language || navigator.userLanguage;

  // Match the whole language subtag, so a code that only begins with "zh", such as "zha", is not treated as Chinese.
  const normalizedLang = typeof lang === 'string' && /^zh(?:[-_]|$)/i.test(lang) ? 'zh_CN' : 'en_US';

  // Update the html document language attribute with a valid BCP 47 tag
  document.documentElement.lang = normalizedLang === 'zh_CN' ? 'zh-CN' : 'en-US';

  return normalizedLang;
};

export const formatTs = (ts) => {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ts2UTC = (ts) => {
  return new Date(ts).toISOString().replace(/\.\d{3}Z$/, 'Z');
};
