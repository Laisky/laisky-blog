import { consumeSSOCallbackToken, hasSSOCallbackParameters } from './sso';
import { initializeOptionalTelemetry } from './telemetry';

/**
 * showSignInError displays local text and optionally a fixed clean article link.
 *
 * @param {boolean} replaceApplication - Whether to replace the root instead of mounting the application.
 * @returns {void} No return value.
 */
const showSignInError = (replaceApplication) => {
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'Sign-in could not be completed. Please try again.';
  if (replaceApplication) {
    const root = document.getElementById('root');
    const link = document.createElement('a');
    link.href = '/pages/0/';
    link.textContent = 'Continue to articles';
    root.replaceChildren(message, link);
  } else {
    document.body.prepend(message);
  }
};

/**
 * bootstrapApplication consumes authentication before mounting the application or optional scripts.
 *
 * @param {function(): void} mountApplication - The existing router and application initializer.
 * @returns {Promise<boolean>} True when mounted, or false when unsafe callback markers remain.
 */
export const bootstrapApplication = async (mountApplication) => {
  let callbackFailed = false;
  try {
    await consumeSSOCallbackToken();
  } catch {
    callbackFailed = true;
  }
  if (hasSSOCallbackParameters()) {
    // A failed history operation must not expose markers to App's analytics/search modules.
    showSignInError(true);
    return false;
  }
  if (callbackFailed) showSignInError(false);
  initializeOptionalTelemetry();
  mountApplication();
  return true;
};
