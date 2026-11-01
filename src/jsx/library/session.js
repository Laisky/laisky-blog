import { jwtDecode } from 'jwt-decode';
import { kvDel, kvDelStrict, kvGetStrict, kvReplaceIfUnchanged, kvRestore, kvSetStrict } from './storage.js';

export const KvKeyUserToken = 'user_token';
// Every release stored this as the decoded token, so it adds nothing; it is no longer read or written, only removed.
export const KvKeyAuthUser = 'auth_user';
export const SessionStatus = Object.freeze({ SignedIn: 'signed-in', SignedOut: 'signed-out', Unavailable: 'unavailable' });

/**
 * Check if a JWT token is expired based on its `exp` claim.
 *
 * @param {string} token - The JWT token string.
 * @returns {boolean} - True if expired or invalid, false otherwise.
 */
export const isJwtExpired = (token) => {
  try {
    const payload = jwtDecode(token);
    if (!payload || typeof payload.exp !== 'number') {
      // No exp means we treat it as invalid for safety
      return true;
    }
    const now = Date.now(); // ms
    const expMs = payload.exp * 1000; // exp is in seconds
    return now >= expMs;
  } catch {
    // Bad token format
    return true;
  }
};

/**
 * getSession reads the current session, keeping "signed out" separate from "could not tell". The name comes from the
 * stored token itself, so it can never belong to a different account than the token sent with privileged requests.
 *
 * @returns {Promise<{status: string, username?: string}>} A SessionStatus, with the username when signed in.
 */
export const getSession = async () => {
  let token;
  try {
    token = await kvGetStrict(KvKeyUserToken);
  } catch {
    // An unreadable sign-in is not a missing one, so it must not be deleted below.
    return { status: SessionStatus.Unavailable };
  }
  if (!token || isJwtExpired(token)) {
    await kvDel(KvKeyAuthUser);
    // Another tab may have signed in since the read. A token left behind here is retried on the next read.
    await kvReplaceIfUnchanged(KvKeyUserToken, token, null).catch(() => {});
    return { status: SessionStatus.SignedOut };
  }

  const claims = jwtDecode(token);
  // Prefer display_name; fall back to common fields
  return { status: SessionStatus.SignedIn, username: claims['display_name'] || claims['username'] || claims['name'] || claims['sub'] };
};

/**
 * Get the current username, for callers that only need to know whether to show signed-in features.
 *
 * @returns {Promise<string|undefined>} The username, or undefined when signed out or unreadable.
 */
export const getCurrentUsername = async () => (await getSession()).username;

/**
 * requireUserToken reads the bearer token for a privileged request, so that request never carries "Bearer null".
 *
 * @returns {Promise<string>} The stored token.
 * @throws {Error} When storage is unusable or no one is signed in.
 */
export const requireUserToken = async () => {
  const token = await kvGetStrict(KvKeyUserToken);
  if (!token) throw new Error('Sign in is required.');
  return token;
};

/**
 * saveSession stores a new session. The session is one key, so it changes in a single write and no partial state exists.
 *
 * @param {string} token - The exchanged bearer token.
 * @returns {Promise<void>} Resolves once the token is durable, and rejects when it is not.
 */
export const saveSession = async (token) => {
  const previousToken = await kvGetStrict(KvKeyUserToken);
  // Sign-in has already been reported as failed if this runs, so the stored state must end up matching that.
  const undoLateCommit = () => kvReplaceIfUnchanged(KvKeyUserToken, token, previousToken);
  try {
    await kvSetStrict(KvKeyUserToken, token, { onLateSuccess: undoLateCommit });
  } catch (error) {
    // A deadline does not cancel a write, so put the earlier session back in case this one commits late.
    await kvRestore(KvKeyUserToken, previousToken).catch(() => {});
    throw error;
  }
  await kvDel(KvKeyAuthUser);
};

/**
 * signOut removes the session durably. The delete runs even if the store was marked as stalled, and only the token
 * decides the result, because the token alone is what keeps a user signed in.
 *
 * @returns {Promise<void>} Resolves once the token is gone, and rejects when that cannot be confirmed.
 */
export const signOut = async () => {
  await kvDelStrict(KvKeyUserToken, { force: true });
  await kvDel(KvKeyAuthUser);
};
