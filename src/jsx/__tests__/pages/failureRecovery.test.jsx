import React from 'react';
import jsutils from '@laisky/js-utils';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../pages/app.jsx';
import { Post } from '../../pages/post.jsx';
import { graphqlQuery, getUserLanguage, setUserLanguage } from '../../library/base.jsx';

vi.mock('@laisky/js-utils', () => ({
  default: {
    SHA256: vi.fn(async (value) => value),
    GetCache: vi.fn(async () => null),
    SetCache: vi.fn(async () => {}),
    KvAddListener: vi.fn(async () => {}),
    KvRemoveListener: vi.fn(),
    KvOp: { SET: 'set' },
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
  isForce: () => false,
  KvKeyLanguage: 'language',
  KvKeyPrefixCache: 'cache:',
}));
vi.mock('../../components/comments.jsx', () => ({ Comments: () => <aside>Comments area</aside> }));
vi.mock('mermaid', () => ({ default: { run: vi.fn(async () => {}) } }));

/** article supplies an entirely local current-article response with an optional authored series fixture. */
const article = (name = 'sample', content = '<h2>Readable body</h2>') => ({
  name,
  title: `Title ${name}`,
  type: 'post',
  content,
  menu: '',
  created_at: '2026-01-01',
  arweave_id: [],
});
/** mountArticle mounts the actual owning components and returns navigation plus unmount controls. */
const mountArticle = (withApp = false) => {
  const route = { path: '/p/:name/', element: <Post isHistory="false" /> };
  const router = createMemoryRouter(withApp ? [{ path: '/', element: <App />, children: [route] }] : [route], {
    initialEntries: ['/p/sample/'],
  });
  const rendered = render(<RouterProvider router={router} />);
  return { router, ...rendered };
};

beforeEach(() => {
  vi.clearAllMocks();
  getUserLanguage.mockResolvedValue('en_US');
  setUserLanguage.mockResolvedValue(undefined);
  jsutils.KvAddListener.mockResolvedValue(undefined);
  window.MathJax = { Hub: { Queue: vi.fn() } };
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  window.scrollTo = vi.fn();
  window.dataLayer = [];
  jsutils.LoadJsModules.mockResolvedValue(true);
  graphqlQuery.mockImplementation(async (_query, variables) => ({ BlogPosts: [article(variables?.name)] }));
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('owned article recovery', () => {
  it('shows an accessible transport failure and replaces it after one user retry', async () => {
    graphqlQuery.mockRejectedValueOnce(new Error('secret-canary transport body'));
    mountArticle();
    const retry = await screen.findByRole('button', { name: 'Retry loading article' });
    expect(screen.queryByText(/secret-canary/)).not.toBeInTheDocument();
    fireEvent.click(retry);
    await screen.findByRole('heading', { name: 'Readable body' });
    expect(screen.queryByRole('button', { name: 'Retry loading article' })).not.toBeInTheDocument();
  });
  it('does not reload the current language during App initialization, but reloads a real language change', async () => {
    let notify;
    jsutils.KvAddListener.mockImplementation(async (_key, listener) => {
      notify = listener;
    });
    const { unmount } = mountArticle(true);
    await screen.findByRole('heading', { name: 'Readable body' });
    expect(graphqlQuery).toHaveBeenCalledTimes(1);
    await act(async () => {
      await notify('language', 'set', null, 'en_US');
    });
    expect(graphqlQuery).toHaveBeenCalledTimes(1);
    getUserLanguage.mockResolvedValue('zh_CN');
    await act(async () => {
      await notify('language', 'set', 'en_US', 'zh_CN');
    });
    await waitFor(() => expect(graphqlQuery).toHaveBeenCalledTimes(2));
    expect(graphqlQuery.mock.calls[1][0]).toContain('language: zh_CN');
    unmount();
    await act(async () => {
      await notify('language', 'set', 'zh_CN', 'en_US');
    });
    expect(graphqlQuery).toHaveBeenCalledTimes(2);
  });
  it('distinguishes an empty article result from a request failure', async () => {
    graphqlQuery.mockResolvedValue({ BlogPosts: [] });
    mountArticle();
    await screen.findByText('This article was not found.');
    expect(screen.queryByRole('button', { name: 'Retry loading article' })).not.toBeInTheDocument();
    expect(jsutils.SetCache).not.toHaveBeenCalledWith(expect.anything(), undefined);
  });
  it.each(['resolve', 'reject'])('ignores a delayed old article %s after route navigation', async (outcome) => {
    let resolveOld, rejectOld;
    const old = new Promise((resolve, reject) => {
      resolveOld = resolve;
      rejectOld = reject;
    });
    graphqlQuery.mockImplementation(async (_query, variables) =>
      variables.name === 'sample' ? old : { BlogPosts: [article('new', '<h2>New body</h2>')] }
    );
    const { router } = mountArticle();
    await waitFor(() => expect(graphqlQuery).toHaveBeenCalled());
    await act(async () => {
      await router.navigate('/p/new/');
    });
    await screen.findByRole('heading', { name: 'New body' });
    await act(async () => {
      if (outcome === 'resolve') resolveOld({ BlogPosts: [article('old', '<h2>Obsolete body</h2>')] });
      else rejectOld(new Error('obsolete private transport error'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole('heading', { name: 'New body' })).toBeInTheDocument();
    expect(screen.queryByText(/Obsolete body|obsolete private/)).not.toBeInTheDocument();
  });
  it('keeps the article and independent series when another series root fails', async () => {
    graphqlQuery.mockImplementation(async (query, variables) => {
      if (!query.includes('GetBlogPostSeries'))
        return {
          BlogPosts: [
            article(
              'sample',
              '<h2>Readable body</h2><div class="post_series" key="broken"></div><div class="post_series" key="good"></div>'
            ),
          ],
        };
      if (variables.key === 'broken') throw new Error('secret-canary series request');
      return { GetBlogPostSeries: [{ remark: 'Working', posts: [{ name: 'sibling', title: 'Working sibling' }], children: [] }] };
    });
    mountArticle();
    await screen.findByText('This series is unavailable.');
    await screen.findByRole('link', { name: 'Working sibling' });
    expect(screen.getByRole('heading', { name: 'Readable body' })).toBeInTheDocument();
    expect(screen.getByText('Comments area')).toBeInTheDocument();
  });
  it('preserves successful nested siblings when a child series fails', async () => {
    graphqlQuery.mockImplementation(async (query, variables) => {
      if (!query.includes('GetBlogPostSeries'))
        return { BlogPosts: [article('sample', '<h2>Readable body</h2><div class="post_series" key="root"></div>')] };
      if (variables.key === 'broken') throw new Error('child request');
      return {
        GetBlogPostSeries: [
          {
            remark: variables.key,
            posts: [{ name: variables.key, title: `Series ${variables.key}` }],
            children: variables.key === 'root' ? [{ key: 'broken' }, { key: 'working' }] : [],
          },
        ],
      };
    });
    mountArticle();
    await screen.findByText('This series is unavailable.');
    await screen.findByRole('link', { name: 'Series working' });
  });
});

describe('independent optional scripts', () => {
  it('recovers search independently while preserving readable content and analytics', async () => {
    jsutils.LoadJsModules.mockImplementation(async ([url]) => {
      if (url.includes('cse.google')) throw new globalThis.Event('error');
      return true;
    });
    mountArticle(true);
    const retry = await screen.findByRole('button', { name: 'Retry search' });
    await screen.findByRole('heading', { name: 'Readable body' });
    expect(window.dataLayer.length).toBeGreaterThan(0);
    jsutils.LoadJsModules.mockResolvedValue(true);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry search' })).not.toBeInTheDocument());
  });
  it('owns an analytics rejection once without raw DOM diagnostics or blocking search', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    jsutils.LoadJsModules.mockImplementation(async ([url]) => {
      if (url.includes('googletagmanager')) throw new globalThis.Event('error');
      return true;
    });
    mountArticle(true);
    await screen.findByRole('heading', { name: 'Readable body' });
    await waitFor(() => expect(warn).toHaveBeenCalledWith('OptionalFeatureError: analytics script load failed (load)'));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Retry search' })).not.toBeInTheDocument();
  });
});
