import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverPendingReports, reportFailure } from '../../library/failureReport.js';

let captureMessage;

beforeEach(() => {
  captureMessage = vi.fn();
  window.Sentry = { captureMessage };
});

afterEach(() => {
  delete window.Sentry;
});

describe('reportFailure', () => {
  it('sends a static grouped message at error level by default', () => {
    const error = new Error('deadline');
    error.name = 'TimeoutError';
    reportFailure('article_load', error);
    expect(captureMessage).toHaveBeenCalledWith('article_load failed (TimeoutError)', {
      level: 'error',
      tags: { blog_operation: 'article_load', blog_failure: 'TimeoutError' },
      fingerprint: ['blog-failure', 'article_load', 'TimeoutError'],
    });
  });

  it('never forwards error text, which can embed requests, responses or tokens', () => {
    const error = new Error('GraphQL Error: {"request":{"token":"LOCAL_ONLY_CANARY"}}');
    error.response = { status: 500, body: 'LOCAL_ONLY_CANARY' };
    reportFailure('article_load', error);
    expect(JSON.stringify(captureMessage.mock.calls)).not.toContain('LOCAL_ONLY_CANARY');
    expect(captureMessage.mock.calls[0][0]).toBe('article_load failed (ClientError)');
  });

  it('collapses an unexpected error name to a static label', () => {
    const error = new Error('boom');
    error.name = 'LOCAL_ONLY_CANARY';
    reportFailure('article_list', error);
    expect(captureMessage.mock.calls[0][0]).toBe('article_list failed (Other)');
  });

  it('handles a non-error rejection', () => {
    reportFailure('article_list', undefined);
    expect(captureMessage.mock.calls[0][0]).toBe('article_list failed (Other)');
  });

  it('ignores a legitimate cancellation', () => {
    const error = new Error('canceled');
    error.name = 'AbortError';
    reportFailure('article_load', error);
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('ignores an operation outside the allowlist', () => {
    reportFailure('LOCAL_ONLY_CANARY', new Error('boom'));
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('does nothing when the SDK is blocked or has not loaded', () => {
    delete window.Sentry;
    expect(() => reportFailure('article_load', new Error('boom'))).not.toThrow();
    window.Sentry = { captureMessage };
    deliverPendingReports();
  });

  it('survives an error whose properties throw', () => {
    const error = new Error('boom');
    Object.defineProperty(error, 'response', {
      get() {
        throw new Error('getter');
      },
    });
    expect(() => reportFailure('article_load', error)).not.toThrow();
  });

  it('never lets a reporting failure reach the page', () => {
    captureMessage.mockImplementation(() => {
      throw new Error('sdk failure');
    });
    expect(() => reportFailure('article_load', new Error('boom'))).not.toThrow();
  });
});

describe('a failure that beats the SDK', () => {
  let script;

  beforeEach(() => {
    delete window.Sentry;
    script = document.createElement('script');
    script.src = 'https://js.sentry-cdn.com/loader.min.js';
    document.head.append(script);
  });

  afterEach(() => {
    script.remove();
  });

  it('is held and sent once when the loader finishes', () => {
    const timeout = new Error('late');
    timeout.name = 'TimeoutError';
    reportFailure('browser_storage', timeout, 'warning');
    window.Sentry = { captureMessage };
    script.dispatchEvent(new window.Event('load'));
    script.dispatchEvent(new window.Event('load'));
    deliverPendingReports();
    expect(captureMessage).toHaveBeenCalledOnce();
    expect(captureMessage.mock.calls[0][0]).toBe('browser_storage failed (TimeoutError)');
    expect(captureMessage.mock.calls[0][1].level).toBe('warning');
  });

  it('holds a bounded number of reports', () => {
    for (let i = 0; i < 20; i++) reportFailure('article_load', new Error('repeat'));
    window.Sentry = { captureMessage };
    deliverPendingReports();
    expect(captureMessage).toHaveBeenCalledTimes(8);
  });

  it('survives an SDK that throws while delivering held reports', () => {
    reportFailure('article_load', new Error('held'));
    window.Sentry = {
      captureMessage: () => {
        throw new Error('sdk failure');
      },
    };
    expect(() => deliverPendingReports()).not.toThrow();
  });
});
