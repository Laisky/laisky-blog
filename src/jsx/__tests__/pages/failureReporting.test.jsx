import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../pages/app.jsx';
import { Page, loader } from '../../pages/pages.jsx';
import { Post } from '../../pages/post.jsx';
import { getCurrentUsername, getUserLanguage, graphqlQuery, isForce, setUserLanguage } from '../../library/base.jsx';

vi.mock('@laisky/js-utils', () => ({
  default: {
    SHA256: vi.fn(async (value) => value),
    GetCache: vi.fn(async () => null),
    SetCache: vi.fn(async () => {}),
    KvAddListener: vi.fn(async () => {}),
    KvRemoveListener: vi.fn(),
    KvOp: { SET: 1 },
    LoadJsModules: vi.fn(),
  },
}));
vi.mock('../../library/base.jsx', () => ({
  formatTs: () => 'today',
  ts2UTC: () => 'today',
  getCurrentUsername: vi.fn(async () => null),
  getUserLanguage: vi.fn(async () => 'en_US'),
  setUserLanguage: vi.fn(async () => {}),
  graphqlQuery: vi.fn(),
  isForce: vi.fn(() => false),
  KvKeyLanguage: 'language',
  KvKeyPrefixCache: 'cache:',
}));
vi.mock('../../components/comments.jsx', () => ({ Comments: () => <aside>Comments area</aside> }));
vi.mock('../../components/sidebar.jsx', () => ({ Sidebar: () => <aside>Sidebar</aside> }));
vi.mock('mermaid', () => ({ default: { run: vi.fn(async () => {}) } }));

/** mountArticle mounts the real article route, optionally inside the real application shell. */
const mountArticle = (withApp = false) => {
  const route = { path: '/p/:name/', element: <Post isHistory="false" /> };
  const router = createMemoryRouter(withApp ? [{ path: '/', element: <App />, children: [route] }] : [route], {
    initialEntries: ['/p/sample/'],
  });
  return render(<RouterProvider router={router} />);
};

/** messages lists the report text sent to Sentry during a test. */
const messages = () => window.Sentry.captureMessage.mock.calls.map(([message]) => message);

beforeEach(() => {
  vi.clearAllMocks();
  window.Sentry = { captureMessage: vi.fn() };
  getUserLanguage.mockResolvedValue('en_US');
  setUserLanguage.mockResolvedValue(undefined);
  getCurrentUsername.mockResolvedValue(null);
  isForce.mockReturnValue(false);
  const append = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
    const result = append(node);
    if (node.tagName === 'SCRIPT') globalThis.queueMicrotask(() => node.dispatchEvent(new globalThis.Event('load')));
    return result;
  });
  window.MathJax = { Hub: { Queue: vi.fn() } };
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  window.scrollTo = vi.fn();
  window.dataLayer = [];
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.Sentry;
});

describe('failures the page handles itself', () => {
  it('reports an article failure exactly once, with no response detail', async () => {
    const error = new Error('GraphQL Error: LOCAL_ONLY_CANARY');
    error.response = { status: 500 };
    graphqlQuery.mockRejectedValue(error);
    mountArticle();
    await screen.findByRole('button', { name: 'Retry loading article' });
    expect(messages()).toEqual(['article_load failed (ClientError)']);
    expect(JSON.stringify(window.Sentry.captureMessage.mock.calls)).not.toContain('LOCAL_ONLY_CANARY');
  });

  it('reports a language failure alongside its visible message', async () => {
    graphqlQuery.mockResolvedValue({
      BlogPosts: [{ name: 'sample', title: 'Sample', type: 'post', content: '<p>Body</p>', menu: '', created_at: '2026-01-01' }],
    });
    setUserLanguage.mockRejectedValue(new TypeError('unavailable'));
    mountArticle(true);
    await screen.findByText(/Language preferences are unavailable/);
    expect(messages()).toEqual(['language_preferences failed (TypeError)']);
  });

  it('does not report an article request abandoned by leaving the page', async () => {
    let reject;
    graphqlQuery.mockImplementation(() => new Promise((_resolve, fail) => (reject = fail)));
    const { unmount } = mountArticle();
    await waitFor(() => expect(graphqlQuery).toHaveBeenCalled());
    unmount();
    await act(async () => reject(new Error('late failure')));
    expect(window.Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('reports a failed article list load', async () => {
    graphqlQuery.mockRejectedValue(new TypeError('Load failed'));
    const data = await loader({ params: { nPage: '0' } });
    expect(data.problem).toBe('request');
    expect(messages()).toEqual(['article_list failed (TypeError)']);
  });

  it('does not report a list request aborted while GraphQL is pending', async () => {
    const controller = new globalThis.AbortController();
    let fail;
    graphqlQuery.mockImplementation(() => new Promise((_resolve, reject) => (fail = reject)));
    const outcome = loader({ params: { nPage: '0' }, request: { signal: controller.signal } }).catch((error) => error);
    await waitFor(() => expect(graphqlQuery).toHaveBeenCalled());
    controller.abort();
    await act(async () => fail(new TypeError('Load failed')));
    expect(await outcome).toBeInstanceOf(TypeError);
    expect(window.Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('reports a failed article list render', async () => {
    getCurrentUsername.mockRejectedValue(new RangeError('Invalid time value'));
    const data = { postsData: [], nPosts: 1, nPage: 0 };
    const router = createMemoryRouter([{ path: '/pages/:nPage/', element: <Page />, loader: () => data }], {
      initialEntries: ['/pages/0/'],
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('alert');
    expect(messages()).toEqual(['article_list failed (RangeError)']);
  });
});
