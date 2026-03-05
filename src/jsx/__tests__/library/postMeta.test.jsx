import { describe, expect, test, vi } from 'vitest';

import { buildLocationPayload, buildMutationPostCandidates, datetimeLocalValueToISO, toDatetimeLocalValue } from '../../library/postMeta';

describe('postMeta helpers', () => {
  test('toDatetimeLocalValue converts ISO value to datetime-local', () => {
    const value = toDatetimeLocalValue('2026-03-05T12:34:56.000Z');
    expect(value).toMatch(/^2026-03-05T\d{2}:\d{2}$/);
  });

  test('datetimeLocalValueToISO returns undefined for invalid value', () => {
    expect(datetimeLocalValueToISO('')).toBeUndefined();
    expect(datetimeLocalValueToISO('not-a-date')).toBeUndefined();
  });

  test('buildLocationPayload normalizes city and coordinates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T08:00:00.000Z'));

    const payload = buildLocationPayload({
      coords: {
        latitude: 39.904201,
        longitude: 116.407394,
        accuracy: 12.4,
      },
      address: {
        city: 'Beijing',
        country: 'China',
      },
      displayName: 'Beijing, China',
    });

    expect(payload).toEqual({
      city: 'Beijing',
      country: 'China',
      latitude: 39.904201,
      longitude: 116.407394,
      accuracy_m: 12,
      display_name: 'Beijing, China',
      provider: 'browser_geolocation',
      captured_at: '2026-03-05T08:00:00.000Z',
    });

    vi.useRealTimers();
  });

  test('buildMutationPostCandidates returns rich-first deduplicated payloads', () => {
    const candidates = buildMutationPostCandidates(
      {
        title: 't',
        name: 'n',
        markdown: 'm',
        type: 'markdown',
      },
      {
        publishAtISO: '2026-03-05T08:00:00.000Z',
        includeLocation: true,
        locationPayload: {
          city: 'Shanghai',
          latitude: 31.23,
          longitude: 121.47,
        },
      }
    );

    expect(candidates[0]).toMatchObject({
      city: 'Shanghai',
      latitude: 31.23,
      longitude: 121.47,
      publish_at: '2026-03-05T08:00:00.000Z',
    });
    expect(candidates[candidates.length - 1]).toEqual({
      title: 't',
      name: 'n',
      markdown: 'm',
      type: 'markdown',
    });
  });
});
