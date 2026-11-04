import { useEffect, useRef } from 'react';
import { kvSubscribe } from './storage.js';

/**
 * useKvChange runs a callback when a stored value changes, for as long as the component is mounted.
 * The subscription is tied to the effect, so it ends with the component and survives StrictMode re-runs.
 *
 * @param {string} key - The key to watch.
 * @param {function(*, *): (void|Promise<void>)} onChange - Receives the new and previous values; the latest render's callback is used.
 * @returns {void} No return value.
 */
export const useKvChange = (key, onChange) => {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => kvSubscribe(key, (value, previous) => latest.current(value, previous)), [key]);
};
