import { afterEach, describe, expect, it, vi } from 'vitest';
import { installEarlyErrorBuffer } from '../../library/sentryEarlyErrorBuffer';

const config = { cleanUrl: true, origin: 'https://blog.example', assets: ['/assets/app.js'] };
let buffer;
const target = new window.EventTarget();

/** emit dispatches an early browser error with a synthetic location and sensitive text. */
const emit = (overrides = {}) => {
  target.dispatchEvent(
    new window.ErrorEvent('error', {
      filename: 'https://blog.example/assets/app.js?TOKEN_CANARY#FRAGMENT_CANARY',
      lineno: 3,
      colno: 9,
      message: 'MESSAGE_CANARY',
      error: new SyntaxError('BODY_CANARY'),
      ...overrides,
    })
  );
};

afterEach(() => {
  buffer?.stop();
  buffer = undefined;
});

describe('offline early error buffer', () => {
  it('preserves only the approved location and static type and flushes once after stopping', () => {
    buffer = installEarlyErrorBuffer(target, config);
    emit();
    emit();
    const captureEvent = vi.fn();
    expect(() => buffer.flush({ captureEvent })).toThrow('Stop');
    buffer.stop();
    emit({ lineno: 4 });
    expect(buffer.flush({ captureEvent })).toBe(1);
    expect(buffer.flush({ captureEvent })).toBe(0);
    expect(captureEvent).toHaveBeenCalledOnce();
    expect(captureEvent.mock.calls[0][0]).toMatchObject({
      exception: {
        values: [
          { type: 'SyntaxError', stacktrace: { frames: [{ filename: 'https://blog.example/assets/app.js', lineno: 3, colno: 9 }] } },
        ],
      },
    });
    expect(JSON.stringify(captureEvent.mock.calls)).not.toContain('CANARY');
  });

  it('bounds distinct errors and rejects foreign or unapproved source locations', () => {
    buffer = installEarlyErrorBuffer(target, config);
    emit({ filename: 'https://evil.example/assets/app.js' });
    emit({ filename: 'https://blog.example/assets/TOKEN_CANARY.js' });
    emit({ lineno: 0 });
    for (let line = 1; line <= 12; line += 1) emit({ lineno: line });
    buffer.stop();
    const captureEvent = vi.fn();
    expect(buffer.flush({ captureEvent })).toBe(8);
    expect(captureEvent).toHaveBeenCalledTimes(8);
    expect(JSON.stringify(captureEvent.mock.calls)).not.toContain('CANARY');
  });

  it('fails closed without callback cleanup or with unsafe configuration', () => {
    for (const invalid of [{ cleanUrl: false }, { origin: 'https://user:token@blog.example' }, { assets: ['/assets/app.js?token=CANARY'] }])
      expect(() => installEarlyErrorBuffer(target, { ...config, ...invalid })).toThrow();
  });

  it('isolates SDK capture failures and still attempts later errors', () => {
    buffer = installEarlyErrorBuffer(target, config);
    emit();
    emit({ lineno: 4 });
    buffer.stop();
    const captureEvent = vi.fn().mockImplementationOnce(() => {
      throw new Error('offline');
    });
    expect(buffer.flush({ captureEvent })).toBe(1);
    expect(captureEvent).toHaveBeenCalledTimes(2);
    expect(buffer.flush({ captureEvent })).toBe(0);
  });

  it('allows a retry if no SDK capture method was supplied', () => {
    buffer = installEarlyErrorBuffer(target, config);
    emit();
    buffer.stop();
    expect(() => buffer.flush({})).toThrow('captureEvent');
    expect(buffer.flush({ captureEvent: vi.fn() })).toBe(1);
  });
});
