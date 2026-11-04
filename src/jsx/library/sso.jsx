'use strict';

import { jwtDecode } from 'jwt-decode';
import { saveSession } from './session.js';

export const SSOLoginEntryURL = 'https://sso.laisky.com/';
export const SSOCallbackURL = 'https://blog.laisky.com';
export const SSOExchangeURL = 'https://sso.laisky.com/sso/token';
export const KvKeySSOTransaction = 'sso_code_transaction';
export const SSOTransactionLifetime = 10 * 60 * 1000;
const SSOLoginEntries = { sso: SSOLoginEntryURL, mcp: 'https://mcp.laisky.com/sso/login' };
const DefaultRedirectPath = '/pages/0/';
export const SSOCallbackParameters = [
  'sso_token',
  'sso_code',
  'sso_state',
  'sso_flow',
  'sso_challenge',
  'sso_challenge_method',
  'code_verifier',
  'sso_verifier',
  'sso_start',
  'sso_return',
  'sso_issuer',
];
const RandomValuePattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const SignInError = 'Sign-in could not be completed. Please try again.';

/**
 * isSSOMarker recognizes only known protocol parameters, including ambiguous case aliases.
 *
 * @param {string} key - A query or fragment parameter name.
 * @returns {boolean} True for a reserved protocol name.
 */
const isSSOMarker = (key) => SSOCallbackParameters.includes(key.toLowerCase());
/**
 * markerKeys snapshots reserved names before deletion to avoid skipping duplicate entries.
 *
 * @param {URLSearchParams} parameters - The untrusted URL parameters.
 * @returns {string[]} The reserved parameter names.
 */
const markerKeys = (parameters) => [...parameters.keys()].filter(isSSOMarker);
/**
 * clearSSOMarkers deletes known markers and their case aliases without changing application fields.
 *
 * @param {URLSearchParams} parameters - The mutable URL parameters.
 * @returns {void} No return value.
 */
const clearSSOMarkers = (parameters) => markerKeys(parameters).forEach((key) => parameters.delete(key));
/**
 * MaxFragmentLength bounds the current page fragment, in characters after "#", that marker checks read.
 *
 * The query reaches the page in a request line that nginx bounds, but the browser never sends the
 * fragment, so only the browser's own URL limit (2 MB in Chrome) applies to it. A longer fragment is
 * not read: the checks treat it as carrying a marker and cleanup drops it, so padding cannot hide a
 * credential and hostile input cannot make parsing exhaust the engine. The bound is eight times the
 * 2,048-character return route, so no fragment that the blog or the issuer writes comes near it.
 */
export const MaxFragmentLength = 16384;
/**
 * someName reports whether any parameter name satisfies a predicate, stopping at the first match.
 *
 * It iterates instead of spreading the names into call arguments, whose count engines limit
 * (JavaScriptCore at 65,536; V8 by stack size), so a long parameter list cannot throw.
 *
 * @param {URLSearchParams} parameters - The parsed parameters.
 * @param {function(string): boolean} matches - The name predicate.
 * @returns {boolean} True when a name matches.
 */
const someName = (parameters, matches) => {
  for (const name of parameters.keys()) if (matches(name)) return true;
  return false;
};
/**
 * fragmentShowsName reports whether a standard fragment reader can see a matching parameter name.
 *
 * A fragment is opaque to URL parsing, but OAuth-style fragment responses read it as form
 * data and hash routers read it as an RFC 3986 relative reference, whose query follows the
 * first "?" and whose nested fragment follows the first "#". Reading every "#"-delimited
 * segment both ways covers both encodings and nested fragments in one linear pass. Names
 * inside values stay ordinary data, matching top-level query parsing. The issuer applies
 * the identical reading (see blog-sso-protocol.v1.json). The reading stops at the first match.
 *
 * @param {string} hash - A URL hash or fragment entry, including a leading "#" when present.
 * @param {function(string): boolean} matches - The name predicate.
 * @returns {boolean} True when a name under either reading matches.
 */
const fragmentShowsName = (hash, matches) =>
  hash
    .replace(/^#/, '')
    .split('#')
    .some((segment) => {
      if (someName(new URLSearchParams(segment), matches)) return true;
      const queryStart = segment.indexOf('?');
      return queryStart >= 0 && someName(new URLSearchParams(segment.slice(queryStart + 1)), matches);
    });
/**
 * isOversizedFragment reports whether a fragment exceeds MaxFragmentLength and must fail closed unread.
 *
 * @param {string} hash - A URL hash or serialized fragment, including a leading "#" when present.
 * @returns {boolean} True when the fragment is too long to read.
 */
const isOversizedFragment = (hash) => hash.replace(/^#/, '').length > MaxFragmentLength;
/**
 * pageFragmentShowsMarker reports whether the current page fragment may carry a reserved name.
 *
 * @param {string} hash - The page URL hash, including its leading "#" when present.
 * @param {function(string): boolean} [matches] - The reserved-name predicate; any marker by default.
 * @returns {boolean} True for a visible match or for a fragment too long to read.
 */
const pageFragmentShowsMarker = (hash, matches = isSSOMarker) => isOversizedFragment(hash) || fragmentShowsName(hash, matches);
/**
 * isBootstrapMarker recognizes the legacy bootstrap names in any letter case.
 *
 * @param {string} key - A query or fragment parameter name.
 * @returns {boolean} True for sso_start, sso_return or sso_issuer.
 */
const isBootstrapMarker = (key) => ['sso_start', 'sso_return', 'sso_issuer'].includes(key.toLowerCase());
/**
 * hasSSOCallbackParameters detects authentication markers in the current callback URL.
 *
 * @returns {boolean} True when any callback marker remains visible, or the fragment is too long to read.
 */
export const hasSSOCallbackParameters = () => {
  const url = new URL(window.location.href);
  return someName(url.searchParams, isSSOMarker) || pageFragmentShowsMarker(url.hash);
};
/**
 * clearSSOURLMarkers removes reserved query names and every fragment entry that shows one.
 *
 * Fragment cleanup works on the "&"-separated form entries that the form-data cleanup always
 * removed. Under either fragment reading, a marker and its value lie inside a single entry,
 * because "&" ends a parameter in both readings. Dropping each entry whose own text shows a
 * marker under either reading therefore removes every marker value, including one hidden in
 * another entry's value such as "note=x?sso_token=...". Checking only the re-encoded result
 * would miss it, since serialization percent-encodes the "?" or "#" that exposed it. Kept
 * entries serialize exactly as before, and a fragment without markers is left untouched.
 * A fragment too long to read, before or after serialization, is dropped whole, so the
 * cleaned URL never fails the bounded checks again.
 *
 * @param {URL} url - The mutable callback URL.
 * @returns {void} No return value.
 */
const clearSSOURLMarkers = (url) => {
  clearSSOMarkers(url.searchParams);
  if (!pageFragmentShowsMarker(url.hash)) return;
  if (isOversizedFragment(url.hash)) {
    url.hash = '';
    return;
  }
  // Frame entries as the form parser does: one leading "?" is dropped, then "&" splits.
  const entries = url.hash.slice(1).replace(/^\?/, '').split('&');
  const kept = entries.filter((entry) => !fragmentShowsName(entry, isSSOMarker));
  // The leading "&" stops the constructor from dropping a "?" that starts a kept entry.
  const cleaned = new URLSearchParams(`&${kept.join('&')}`).toString();
  // Serialization percent-encodes kept text, which can grow it past the bound.
  url.hash = isOversizedFragment(cleaned) ? '' : cleaned;
};

/**
 * sanitizeRedirectPath validates a bounded same-origin path, including its query and fragment.
 *
 * @param {unknown} redirectPath - The untrusted stored route.
 * @returns {string} The normalized internal path or the default article route.
 */
export const sanitizeRedirectPath = (redirectPath) => {
  if (
    typeof redirectPath !== 'string' ||
    redirectPath.length > 2048 ||
    !redirectPath.startsWith('/') ||
    redirectPath.startsWith('//') ||
    redirectPath.includes('\\') ||
    Array.from(redirectPath).some((char) => char.charCodeAt(0) <= 32)
  )
    return DefaultRedirectPath;
  try {
    const url = new URL(redirectPath, SSOCallbackURL);
    // The 2,048-character route bound already limits this reading, which must match the issuer's exactly.
    if (url.origin !== SSOCallbackURL || someName(url.searchParams, isSSOMarker) || fragmentShowsName(url.hash, isSSOMarker)) {
      return DefaultRedirectPath;
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return DefaultRedirectPath;
  }
};

/**
 * encodeBase64URL encodes bytes without padding for state, verifier, or challenge values.
 *
 * @param {Uint8Array} bytes - The bytes to encode.
 * @returns {string} The URL-safe base64 representation.
 */
const encodeBase64URL = (bytes) =>
  globalThis
    .btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

/**
 * buildSSOLoginURL builds an opt-in code-flow URL containing only public transaction bindings.
 *
 * @param {string} state - The random transaction state.
 * @param {string} challenge - The SHA-256 verifier challenge.
 * @param {'sso'|'mcp'} [issuer] - A fixed trusted login entry; never an arbitrary URL.
 * @returns {string} The hosted issuer URL, with no reusable bearer or verifier.
 */
export const buildSSOLoginURL = (state, challenge, issuer = 'sso') => {
  if (!['sso', 'mcp'].includes(issuer) || !RandomValuePattern.test(state) || !RandomValuePattern.test(challenge))
    throw new Error(SignInError);
  const callback = new URL(SSOCallbackURL);
  callback.searchParams.set('sso_flow', 'code');
  callback.searchParams.set('sso_state', state);
  callback.searchParams.set('sso_challenge', challenge);
  callback.searchParams.set('sso_challenge_method', 'S256');
  const login = new URL(SSOLoginEntries[issuer]);
  login.searchParams.set('redirect_to', callback.toString());
  return login.toString();
};

/**
 * startSSOLogin creates a tab-local PKCE transaction before navigating to the issuer.
 *
 * @param {string} [returnPath] - An optional validated internal route from a legacy bookmark.
 * @param {'sso'|'mcp'} [issuer] - A fixed trusted login entry from an approved bootstrap.
 * @returns {Promise<void>} Resolves after navigation is requested, or rejects safely.
 */
export const startSSOLogin = async (returnPath, issuer = 'sso') => {
  try {
    window.sessionStorage.removeItem(KvKeySSOTransaction);
    const verifier = encodeBase64URL(crypto.getRandomValues(new Uint8Array(32)));
    const state = encodeBase64URL(crypto.getRandomValues(new Uint8Array(32)));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = encodeBase64URL(new Uint8Array(digest));
    const transaction = {
      state,
      verifier,
      createdAt: Date.now(),
      redirectPath: sanitizeRedirectPath(returnPath ?? window.location.pathname + window.location.search + window.location.hash),
    };
    window.sessionStorage.setItem(KvKeySSOTransaction, JSON.stringify(transaction));
    window.location.assign(buildSSOLoginURL(state, challenge, issuer));
  } catch {
    try {
      window.sessionStorage.removeItem(KvKeySSOTransaction);
    } catch {
      throw new Error(SignInError);
    }
    throw new Error(SignInError);
  }
};

/**
 * consumeSSOBootstrap cleans a credential-free legacy entry and starts a fresh consumer-owned transaction.
 *
 * @returns {Promise<boolean>} True after initiation, false for an ordinary URL, or rejects safely.
 */
export const consumeSSOBootstrap = async () => {
  const url = new URL(window.location.href);
  if (!someName(url.searchParams, isBootstrapMarker) && !pageFragmentShowsMarker(url.hash, isBootstrapMarker)) return false;
  const parameters = url.searchParams;
  const returnPath = parameters.get('sso_return');
  const issuer = parameters.get('sso_issuer') ?? 'sso';
  const valid =
    url.origin === SSOCallbackURL &&
    url.pathname === '/' &&
    !url.hash &&
    parameters.getAll('sso_start').length === 1 &&
    parameters.get('sso_start') === '1' &&
    parameters.getAll('sso_return').length === 1 &&
    parameters.getAll('sso_issuer').length <= 1 &&
    ['sso', 'mcp'].includes(issuer) &&
    [...parameters.keys()].every((key) => ['sso_start', 'sso_return', 'sso_issuer'].includes(key)) &&
    returnPath !== null &&
    sanitizeRedirectPath(returnPath) === returnPath;
  clearSSOURLMarkers(url);
  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  if (!valid) {
    window.sessionStorage.removeItem(KvKeySSOTransaction);
    throw new Error(SignInError);
  }
  await startSSOLogin(returnPath, issuer);
  return true;
};

/**
 * takeTransaction removes the initiating transaction before validating or redeeming a callback.
 *
 * @param {string} state - The callback state to bind.
 * @returns {object} The validated single-use transaction.
 */
const takeTransaction = (state) => {
  const raw = window.sessionStorage.getItem(KvKeySSOTransaction);
  window.sessionStorage.removeItem(KvKeySSOTransaction);
  if (!raw || raw.length > 4096) throw new Error(SignInError);
  const transaction = JSON.parse(raw);
  if (
    !transaction ||
    transaction.state !== state ||
    !RandomValuePattern.test(transaction.state) ||
    !RandomValuePattern.test(transaction.verifier) ||
    !Number.isSafeInteger(transaction.createdAt) ||
    transaction.createdAt > Date.now() ||
    Date.now() - transaction.createdAt > SSOTransactionLifetime
  ) {
    throw new Error(SignInError);
  }
  return transaction;
};

/**
 * exchangeCode redeems a code at the fixed issuer without redirects, cookies, caching, or referrers.
 *
 * @param {string} code - The short-lived code.
 * @param {object} transaction - The consumed state and verifier.
 * @returns {Promise<string>} The existing bearer, once its claims pass the UI sanity checks.
 */
const exchangeCode = async (code, transaction) => {
  const controller = new globalThis.AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await globalThis.fetch(SSOExchangeURL, {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        client_id: 'blog',
        redirect_uri: SSOCallbackURL,
        code,
        state: transaction.state,
        code_verifier: transaction.verifier,
      }),
    });
    if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
      throw new Error(SignInError);
    }
    // Bound the response before JSON parsing; issuer credentials must not be logged.
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        throw new Error(SignInError);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const data = JSON.parse(new globalThis.TextDecoder().decode(bytes));
    if (
      data.token_type !== 'Bearer' ||
      !Number.isSafeInteger(data.expires_in) ||
      data.expires_in <= 0 ||
      typeof data.access_token !== 'string' ||
      data.access_token.length > 16384 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.access_token)
    )
      throw new Error(SignInError);
    const user = jwtDecode(data.access_token);
    if (!Number.isFinite(user.exp) || user.exp <= Math.floor(Date.now() / 1000)) throw new Error(SignInError);
    // These are UI sanity checks; the issuer and mutation backend verify signature and authorization.
    return data.access_token;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * consumeSSOCallbackToken cleans callback markers synchronously and accepts only a bound code.
 *
 * @returns {Promise<boolean>} True after a code callback; false for an ordinary URL, or rejects safely.
 */
export const consumeSSOCallbackToken = async () => {
  const url = new URL(window.location.href);
  const fragmentShowsMarker = pageFragmentShowsMarker(url.hash);
  if (!someName(url.searchParams, isSSOMarker) && !fragmentShowsMarker) return false;
  const parameters = url.searchParams;
  const code = parameters.get('sso_code');
  const state = parameters.get('sso_state');
  const valid =
    url.origin === SSOCallbackURL &&
    url.pathname === '/' &&
    parameters.getAll('sso_code').length === 1 &&
    parameters.getAll('sso_state').length === 1 &&
    RandomValuePattern.test(code || '') &&
    RandomValuePattern.test(state || '') &&
    markerKeys(parameters).every((key) => ['sso_code', 'sso_state'].includes(key)) &&
    !fragmentShowsMarker;
  clearSSOURLMarkers(url);
  const cleanURL = url.pathname + url.search + url.hash;
  window.history.replaceState({}, document.title, cleanURL);
  try {
    // Reject legacy bearers without touching an existing session or sending them anywhere.
    if (!valid) {
      window.sessionStorage.removeItem(KvKeySSOTransaction);
      throw new Error(SignInError);
    }
    const transaction = takeTransaction(state);
    await saveSession(await exchangeCode(code, transaction));
    const redirect = sanitizeRedirectPath(transaction.redirectPath);
    if (redirect !== cleanURL) window.location.replace(redirect);
    return true;
  } catch {
    throw new Error(SignInError);
  }
};
