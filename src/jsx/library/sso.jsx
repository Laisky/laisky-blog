'use strict';

import jsutils from '@laisky/js-utils';
import { jwtDecode } from 'jwt-decode';
import { KvKeyAuthUser, KvKeyUserToken } from './base.jsx';

export const SSOLoginEntryURL = 'https://sso.laisky.com/';
export const SSOCallbackURL = 'https://blog.laisky.com';
export const SSOExchangeURL = 'https://sso.laisky.com/sso/token';
export const KvKeySSOTransaction = 'sso_code_transaction';
export const SSOTransactionLifetime = 10 * 60 * 1000;
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
];
const RandomValuePattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const SignInError = 'Sign-in could not be completed. Please try again.';

/**
 * hasSSOCallbackParameters detects authentication markers in the current callback URL.
 *
 * @returns {boolean} True when any callback marker remains visible.
 */
export const hasSSOCallbackParameters = () => SSOCallbackParameters.some((key) => new URL(window.location.href).searchParams.has(key));

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
    if (url.origin !== SSOCallbackURL || SSOCallbackParameters.some((key) => url.searchParams.has(key))) {
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
 * @returns {string} The hosted issuer URL, with no reusable bearer or verifier.
 */
export const buildSSOLoginURL = (state, challenge) => {
  if (!RandomValuePattern.test(state) || !RandomValuePattern.test(challenge)) throw new Error(SignInError);
  const callback = new URL(SSOCallbackURL);
  callback.searchParams.set('sso_flow', 'code');
  callback.searchParams.set('sso_state', state);
  callback.searchParams.set('sso_challenge', challenge);
  callback.searchParams.set('sso_challenge_method', 'S256');
  const login = new URL(SSOLoginEntryURL);
  login.searchParams.set('redirect_to', callback.toString());
  return login.toString();
};

/**
 * startSSOLogin creates a tab-local PKCE transaction before navigating to the issuer.
 *
 * @returns {Promise<void>} Resolves after navigation is requested, or rejects safely.
 */
export const startSSOLogin = async () => {
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
      redirectPath: sanitizeRedirectPath(window.location.pathname + window.location.search + window.location.hash),
    };
    window.sessionStorage.setItem(KvKeySSOTransaction, JSON.stringify(transaction));
    window.location.assign(buildSSOLoginURL(state, challenge));
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
 * @returns {Promise<{token: string, user: object}>} The existing bearer and decoded UI claims.
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
    return { token: data.access_token, user };
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * persistSession writes existing auth keys and restores their prior values after a partial failure.
 *
 * @param {{token: string, user: object}} session - The exchanged bearer and UI claims.
 * @returns {Promise<void>} Resolves after both writes, or rejects after rollback.
 */
const persistSession = async (session) => {
  const previousUser = await jsutils.KvGet(KvKeyAuthUser);
  const previousToken = await jsutils.KvGet(KvKeyUserToken);
  try {
    await jsutils.KvSet(KvKeyAuthUser, session.user);
    await jsutils.KvSet(KvKeyUserToken, session.token);
  } catch {
    await Promise.all([
      previousUser == null ? jsutils.KvDel(KvKeyAuthUser) : jsutils.KvSet(KvKeyAuthUser, previousUser),
      previousToken == null ? jsutils.KvDel(KvKeyUserToken) : jsutils.KvSet(KvKeyUserToken, previousToken),
    ]);
    throw new Error(SignInError);
  }
};

/**
 * consumeSSOCallbackToken cleans callback markers synchronously and accepts only a bound code.
 *
 * @returns {Promise<boolean>} True after a code callback; false for an ordinary URL, or rejects safely.
 */
export const consumeSSOCallbackToken = async () => {
  const url = new URL(window.location.href);
  if (!SSOCallbackParameters.some((key) => url.searchParams.has(key))) return false;
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
    SSOCallbackParameters.filter((key) => !['sso_code', 'sso_state'].includes(key)).every((key) => !parameters.has(key));
  for (const key of SSOCallbackParameters) url.searchParams.delete(key);
  const cleanURL = url.pathname + url.search + url.hash;
  window.history.replaceState({}, document.title, cleanURL);
  try {
    // Reject legacy bearers without touching an existing session or sending them anywhere.
    if (!valid) {
      window.sessionStorage.removeItem(KvKeySSOTransaction);
      throw new Error(SignInError);
    }
    const transaction = takeTransaction(state);
    const session = await exchangeCode(code, transaction);
    await persistSession(session);
    const redirect = sanitizeRedirectPath(transaction.redirectPath);
    if (redirect !== cleanURL) window.location.replace(redirect);
    return true;
  } catch {
    throw new Error(SignInError);
  }
};
