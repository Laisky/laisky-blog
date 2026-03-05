'use strict';

/**
 * toDatetimeLocalValue converts an ISO timestamp or Date-like value to datetime-local input format.
 *
 * @param {string|number|Date|null|undefined} value - Any date-compatible value.
 * @returns {string} Datetime-local formatted value (YYYY-MM-DDTHH:mm) in local timezone.
 */
export const toDatetimeLocalValue = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

/**
 * datetimeLocalValueToISO converts a datetime-local value to an ISO UTC timestamp.
 *
 * @param {string} value - Datetime-local value from input control.
 * @returns {string|undefined} ISO UTC timestamp if valid.
 */
export const datetimeLocalValueToISO = (value) => {
  if (!value || typeof value !== 'string') {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

/**
 * buildLocationPayload normalizes browser geolocation and reverse-geocode result.
 *
 * @param {Object} options - Source location data.
 * @param {Object} options.coords - Coordinates from Geolocation API.
 * @param {number} options.coords.latitude - Latitude in degrees.
 * @param {number} options.coords.longitude - Longitude in degrees.
 * @param {number} [options.coords.accuracy] - Accuracy in meters.
 * @param {Object} [options.address] - Reverse-geocode address object.
 * @param {string} [options.displayName] - Human-readable location string.
 * @returns {Object|null} Normalized location payload.
 */
export const buildLocationPayload = ({ coords, address, displayName }) => {
  if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
    return null;
  }

  const city = address?.city || address?.town || address?.village || address?.county || address?.state || null;

  return {
    city,
    country: address?.country || null,
    latitude: Number(coords.latitude.toFixed(6)),
    longitude: Number(coords.longitude.toFixed(6)),
    accuracy_m: Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : null,
    display_name: displayName || null,
    provider: 'browser_geolocation',
    captured_at: new Date().toISOString(),
  };
};

/**
 * buildMutationPostCandidates generates schema-compatible mutation payload attempts.
 *
 * @param {Object} basePost - Required base post payload.
 * @param {Object} options - Optional metadata fields.
 * @param {string} [options.publishAtISO] - Publish time in ISO UTC format.
 * @param {Object|null} [options.locationPayload] - Location payload from browser capture.
 * @param {boolean} [options.includeLocation] - Whether location should be attached.
 * @returns {Object[]} Ordered mutation candidates from richest to most compatible.
 */
export const buildMutationPostCandidates = (basePost, { publishAtISO, locationPayload, includeLocation = false }) => {
  const candidates = [];
  const normalizedBase = { ...basePost };

  if (publishAtISO) {
    candidates.push({ ...normalizedBase, publish_at: publishAtISO });
    candidates.push({ ...normalizedBase, created_at: publishAtISO });
  }

  if (includeLocation && locationPayload) {
    const baseWithTime = candidates.length > 0 ? candidates[0] : normalizedBase;
    candidates.unshift({ ...baseWithTime, location: locationPayload });
    candidates.unshift({
      ...baseWithTime,
      city: locationPayload.city,
      latitude: locationPayload.latitude,
      longitude: locationPayload.longitude,
    });
  }

  candidates.push(normalizedBase);

  // Deduplicate candidate payloads to avoid repeated requests.
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};
