import { hasSSOCallbackParameters } from './sso';

export const TelemetryLoaderURL = 'https://js.sentry-cdn.com/0a5aa56db9cb55dc305a90b5ec8a5c51.min.js';

/**
 * initializeOptionalTelemetry loads the optional SDK only after the URL contains no callback markers. The inline loader in
 * index.html has already done this for a clean URL, so this path covers a callback URL once it has been cleaned.
 *
 * @returns {boolean} True when initialized, or false when cleanup could not be completed.
 */
export const initializeOptionalTelemetry = () => {
  if (hasSSOCallbackParameters()) {
    return false;
  }
  if (document.querySelector(`script[src="${TelemetryLoaderURL}"]`)) {
    return true;
  }
  const telemetry = document.createElement('script');
  telemetry.async = true;
  telemetry.crossOrigin = 'anonymous';
  telemetry.referrerPolicy = 'no-referrer';
  telemetry.src = TelemetryLoaderURL;
  document.body.append(telemetry);
  return true;
};
