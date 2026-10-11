import { hasSSOCallbackParameters } from './sso';

/**
 * initializeOptionalTelemetry loads the optional SDK only after the URL contains no callback markers.
 *
 * @returns {boolean} True when initialized, or false when cleanup could not be completed.
 */
export const initializeOptionalTelemetry = () => {
  if (hasSSOCallbackParameters()) {
    return false;
  }
  const telemetry = document.createElement('script');
  telemetry.async = true;
  telemetry.crossOrigin = 'anonymous';
  telemetry.referrerPolicy = 'no-referrer';
  telemetry.src = 'https://js.sentry-cdn.com/0a5aa56db9cb55dc305a90b5ec8a5c51.min.js';
  document.body.append(telemetry);
  return true;
};
