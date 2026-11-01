import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportFailure } from '../../library/failureReport.js';

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
  });

  it('never lets a reporting failure reach the page', () => {
    captureMessage.mockImplementation(() => {
      throw new Error('sdk failure');
    });
    expect(() => reportFailure('article_load', new Error('boom'))).not.toThrow();
  });
});
