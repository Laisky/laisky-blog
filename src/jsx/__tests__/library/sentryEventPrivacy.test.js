import { describe, expect, it, vi } from 'vitest';
import { createOfflineSentryAdapter, installOfflineSentryAdapter } from '../../library/sentryEventPrivacy.js';

const settings = {
  commit: 'a'.repeat(40),
  build: 'b'.repeat(64),
  environment: 'production',
  origin: 'https://blog.example',
  assets: ['/assets/index-123.js'],
};

/**
 * initialize captures the opt-in SDK options for an isolated simulated loader.
 *
 * @returns {object} The options passed to the SDK fixture.
 */
const initialize = () => {
  const sentry = { init: vi.fn(), makeFetchTransport: vi.fn() };
  createOfflineSentryAdapter(settings)(sentry);
  return sentry.init.mock.calls[0][0];
};

describe('offline Sentry error event adapter', () => {
  it('preserves trusted build identity, exception type, known source position and static handled failures', () => {
    const options = initialize();
    const event = options.beforeSend({
      event_id: 'd'.repeat(32),
      timestamp: 1234,
      level: 'error',
      tags: { blog_operation: 'article_load', blog_failure: 'TypeError' },
      exception: {
        values: [
          {
            type: 'TypeError',
            mechanism: { handled: false },
            stacktrace: {
              frames: [{ filename: 'https://blog.example/assets/index-123.js?token=secret#fragment', lineno: 50, colno: 23, in_app: true }],
            },
          },
        ],
      },
    });
    expect(options.sendDefaultPii).toBe(false);
    expect(event).toMatchObject({
      release: `blog@${settings.commit}+sha256.${settings.build}`,
      environment: 'production',
      message: 'article_load failed (TypeError)',
      fingerprint: ['blog-failure', 'article_load', 'TypeError'],
      exception: {
        values: [
          {
            type: 'TypeError',
            mechanism: { type: 'generic', handled: false },
            stacktrace: { frames: [{ filename: 'https://blog.example/assets/index-123.js', lineno: 50, colno: 23, in_app: true }] },
          },
        ],
      },
    });
    expect(JSON.stringify(event)).not.toContain('secret');
  });

  it('removes synthetic private fields from the full error event rather than only the report call', () => {
    const canaries = [
      'QUERY_CANARY',
      'TOKEN_CANARY',
      'COOKIE_CANARY',
      'ACCOUNT_CANARY',
      'USER_CANARY',
      'IP_CANARY',
      'REQUEST_BODY_CANARY',
      'RESPONSE_BODY_CANARY',
      'DOM_CANARY',
      'STORAGE_CANARY',
    ];
    const raw = {
      message: canaries.join(' '),
      user: { id: canaries[4], email: canaries[3], ip_address: canaries[5] },
      request: {
        url: `https://blog.example/?${canaries[0]}`,
        headers: { Cookie: canaries[2], Authorization: canaries[1] },
        data: canaries[6],
      },
      response: { body: canaries[7] },
      extra: { dom: canaries[8], storage: canaries[9] },
      breadcrumbs: [{ message: canaries.join(' ') }],
      contexts: { account: canaries[3] },
      exception: {
        values: [
          {
            type: 'SyntaxError',
            value: canaries.join(' '),
            stacktrace: {
              frames: [
                {
                  filename: `https://blog.example/assets/index-123.js?${canaries[0]}`,
                  lineno: 4,
                  colno: 7,
                  function: canaries[1],
                  vars: { token: canaries[1] },
                  pre_context: canaries,
                },
              ],
            },
          },
        ],
      },
    };
    expect(JSON.stringify(raw)).toContain(canaries[0]);
    const result = initialize().beforeSend(raw);
    for (const canary of canaries) expect(JSON.stringify(result)).not.toContain(canary);
    expect(result.exception.values[0]).toMatchObject({ type: 'SyntaxError', stacktrace: { frames: [{ lineno: 4, colno: 7 }] } });
  });

  it('rejects foreign, unlisted, malformed or credentialed frame URLs without dropping the event', () => {
    const event = initialize().beforeSend({
      exception: {
        values: [
          {
            type: 'Unexpected TOKEN_CANARY',
            stacktrace: {
              frames: [
                { filename: 'https://evil.example/assets/index-123.js', lineno: 1 },
                { abs_path: 'https://evil.example/assets/index-123.js', filename: '/assets/index-123.js', lineno: 1 },
                { filename: 'https://blog.example/assets/TOKEN_CANARY.js', lineno: 1 },
                { filename: 'https://user:pass@blog.example/assets/index-123.js', lineno: 1 },
                { filename: 'http://[invalid', lineno: 1 },
              ],
            },
          },
        ],
      },
    });
    expect(event.exception.values).toEqual([{ type: 'Error' }]);
  });

  it('preserves the inline bundle startup diagnostic only for its exact static pair', () => {
    const event = initialize().beforeSend({ tags: { blog_operation: 'application_bundle', blog_failure: 'not_started' } });
    expect(event).toMatchObject({
      message: 'application_bundle failed (not_started)',
      tags: { blog_operation: 'application_bundle', blog_failure: 'not_started' },
      fingerprint: ['blog-failure', 'application_bundle', 'not_started'],
    });
    const rejected = initialize().beforeSend({ tags: { blog_operation: 'application_bundle', blog_failure: 'TypeError' } });
    expect(rejected.message).toBeUndefined();
  });

  it('does not trust event-supplied release, environment, messages, arbitrary tags or grouping', () => {
    const event = initialize().beforeSend({
      event_id: { toString: () => 'd'.repeat(32), secret: 'TOKEN_CANARY' },
      release: 'TOKEN_CANARY',
      environment: 'USER_CANARY',
      message: 'COOKIE_CANARY',
      tags: { blog_operation: 'TOKEN_CANARY', blog_failure: 'TypeError' },
      fingerprint: ['TOKEN_CANARY'],
    });
    expect(event).toEqual({
      platform: 'javascript',
      release: `blog@${settings.commit}+sha256.${settings.build}`,
      environment: 'production',
    });
  });

  it('validates all build identity and configuration inputs before installation', () => {
    for (const bad of [
      { commit: 'abc' },
      { build: 'abc' },
      { environment: 'custom' },
      { origin: 'https://user:password@blog.example' },
      { origin: 'https://blog.example/private' },
      { assets: ['/assets/index.js?token=secret'] },
      { assets: [] },
    ])
      expect(() => createOfflineSentryAdapter({ ...settings, ...bad })).toThrow();
  });

  it('gates non-error envelopes and strips attachments and sensitive envelope headers', async () => {
    const send = vi.fn().mockResolvedValue({ statusCode: 200 });
    const flush = vi.fn().mockResolvedValue(true);
    const sentry = { init: vi.fn(), makeFetchTransport: vi.fn(() => ({ send, flush })) };
    createOfflineSentryAdapter(settings)(sentry);
    const options = sentry.init.mock.calls[0][0];
    expect(options.autoSessionTracking).toBe(false);
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(0);
    const transport = options.transport({});
    const error = {
      event_id: 'a'.repeat(32),
      exception: { values: [{ type: 'TypeError', value: 'TOKEN_CANARY' }] },
      request: { headers: { cookie: 'COOKIE_CANARY' } },
    };
    await transport.send([
      { event_id: 'a'.repeat(32), trace: { baggage: 'TRACE_CANARY' } },
      [
        [{ type: 'event', extra: 'HEADER_CANARY' }, error],
        [{ type: 'attachment' }, 'ATTACHMENT_CANARY'],
        [{ type: 'session' }, { did: 'SESSION_CANARY' }],
        [{ type: 'transaction' }, { transaction: 'TRANSACTION_CANARY' }],
        [{ type: 'event' }, { type: 'transaction', transaction: 'DISGUISED_CANARY' }],
        [{ type: 'replay_event' }, { replay: 'REPLAY_CANARY' }],
        [{ type: 'replay_recording' }, 'DOM_CANARY'],
        [{ type: 'unknown' }, 'UNKNOWN_CANARY'],
      ],
    ]);
    expect(send).toHaveBeenCalledOnce();
    const forwarded = send.mock.calls[0][0];
    expect(forwarded[1]).toHaveLength(1);
    expect(forwarded[1][0][1].exception.values[0].type).toBe('TypeError');
    expect(JSON.stringify(forwarded)).not.toMatch(/CANARY/);
    await transport.send([{}, [[{ type: 'session' }, { did: 'SESSION_CANARY' }]]]);
    expect(send).toHaveBeenCalledOnce();
    expect(await transport.flush(123)).toBe(true);
    expect(flush).toHaveBeenCalledWith(123);
  });

  it('refuses to initialize without a guarded transport', () => {
    expect(() => createOfflineSentryAdapter(settings)({ init: vi.fn() })).toThrow('transport');
  });

  it('can be installed before a clean loader and after a callback has been cleaned', () => {
    for (const callback of [false, true]) {
      const target = { Sentry: { init: vi.fn(), makeFetchTransport: vi.fn() } };
      const steps = [];
      if (callback) steps.push('callback-cleaned');
      installOfflineSentryAdapter(target, settings);
      steps.push('adapter-installed');
      // This is an intercepted loader fixture: no CDN or production event is contacted.
      target.sentryOnLoad();
      steps.push('loader-fired');
      expect(target.Sentry.init).toHaveBeenCalledOnce();
      expect(steps).toEqual(callback ? ['callback-cleaned', 'adapter-installed', 'loader-fired'] : ['adapter-installed', 'loader-fired']);
      expect(() => installOfflineSentryAdapter(target, settings)).toThrow('already installed');
    }
  });
});
