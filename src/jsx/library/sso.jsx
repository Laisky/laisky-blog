'use strict';

import jsutils from '@laisky/js-utils';
import { jwtDecode } from 'jwt-decode';
import { isJwtExpired, KvKeyAuthUser, KvKeyUserToken } from './base.jsx';

export const SSOLoginEntryURL = 'https://sso.laisky.com/';
export const SSOCallbackURL = 'https://blog.laisky.com';
export const KvKeySSORedirectPath = 'sso_redirect_path';
const DefaultRedirectPath = '/pages/0/';

/**
 * sanitizeRedirectPath validates and normalizes internal redirect paths.
 *
 * @param {string|null} redirectPath - The raw redirect path to validate.
 * @returns {string} The safe internal redirect path.
 */
export const sanitizeRedirectPath = (redirectPath) => {
  if (!redirectPath || typeof redirectPath !== 'string') {
    return DefaultRedirectPath;
  }

  if (!redirectPath.startsWith('/') || redirectPath.startsWith('//')) {
    return DefaultRedirectPath;
  }

  return redirectPath;
};

/**
 * buildSSOLoginURL builds the hosted SSO login URL with callback target.
 *
 * @returns {string} The complete SSO login URL.
 */
export const buildSSOLoginURL = () => {
  const ssoURL = new URL(SSOLoginEntryURL);
  ssoURL.searchParams.set('redirect_to', SSOCallbackURL);
  return ssoURL.toString();
};

/**
 * startSSOLogin stores current route and redirects browser to the SSO login page.
 *
 * @returns {void} No return value.
 */
export const startSSOLogin = () => {
  const currentPath = sanitizeRedirectPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  window.sessionStorage.setItem(KvKeySSORedirectPath, currentPath);
  window.location.assign(buildSSOLoginURL());
};

/**
 * buildCurrentURLWithoutSSOToken removes SSO callback token from current URL.
 *
 * @returns {string} The current URL path/search/hash without `sso_token`.
 */
const buildCurrentURLWithoutSSOToken = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('sso_token');
  return `${url.pathname}${url.search}${url.hash}`;
};

/**
 * consumeSSOCallbackToken persists SSO callback token and redirects to stored path.
 *
 * @returns {Promise<boolean>} True if callback token was present and handled.
 */
export const consumeSSOCallbackToken = async () => {
  const queryParams = new window.URLSearchParams(window.location.search);
  const ssoToken = queryParams.get('sso_token');
  if (!ssoToken) {
    return false;
  }

  const cleanCurrentURL = buildCurrentURLWithoutSSOToken();
  const redirectPath = sanitizeRedirectPath(window.sessionStorage.getItem(KvKeySSORedirectPath));
  window.sessionStorage.removeItem(KvKeySSORedirectPath);

  try {
    if (isJwtExpired(ssoToken)) {
      throw new Error('expired sso token');
    }

    const authUser = jwtDecode(ssoToken);
    await jsutils.KvSet(KvKeyAuthUser, authUser);
    await jsutils.KvSet(KvKeyUserToken, ssoToken);
  } catch {
    await jsutils.KvDel(KvKeyAuthUser);
    await jsutils.KvDel(KvKeyUserToken);
    window.history.replaceState({}, document.title, cleanCurrentURL);
    return true;
  }

  if (redirectPath !== cleanCurrentURL) {
    window.location.replace(redirectPath);
    return true;
  }

  window.history.replaceState({}, document.title, cleanCurrentURL);
  return true;
};
