import React from 'react';
import jsutils from '@laisky/js-utils';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Page, loader } from '../../pages/pages.jsx';
import { graphqlQuery, getUserLanguage, isForce } from '../../library/base.jsx';
import { loader as postLoader } from '../../pages/post.jsx';

vi.mock('@laisky/js-utils', () => ({
  default: {
    SHA256: vi.fn(async (value) => value),
    GetCache: vi.fn(),
    SetCache: vi.fn(),
    KvAddListener: vi.fn(),
    KvRemoveListener: vi.fn(),
    KvOp: { SET: 'set' },
  },
}));
vi.mock('../../library/base.jsx', () => ({
  graphqlQuery: vi.fn(),
  getUserLanguage: vi.fn(),
  isForce: vi.fn(),
  getCurrentUsername: vi.fn(async () => null),
  formatTs: () => 'today',
  ts2UTC: () => 'today',
  KvKeyLanguage: 'language',
  KvKeyPrefixCache: 'cache:',
}));
vi.mock('../../pages/post.jsx', () => ({ loader: vi.fn(async () => ({})) }));
vi.mock('../../components/sidebar.jsx', () => ({ Sidebar: () => <aside>Sidebar</aside> }));

let total;
let cache;
let requests;
let languageListener;
/** posts returns distinct local list fixtures without making any external requests. */
const posts = (page = 0) =>
  Array.from({ length: Math.max(0, Math.min(10, total - page * 10)) }, (_, index) => ({
    name: `post-${page * 10 + index}`,
    title: `Article ${page * 10 + index}`,
    markdown: 'Local excerpt',
    created_at: '2026-01-01',
  }));
/** respond records the real GraphQL selection and serves the requested local page or count. */
const respond = async (query) => {
  if (query.includes('BlogPostInfo')) {
    requests.push('count');
    return { BlogPostInfo: { total } };
  }
  const match = query.match(/page:\s*([^\s}]+)/g)?.at(-1);
  const page = Number(match?.split(':')[1]);
  requests.push(page);
  return { BlogPosts: posts(page) };
};
/** mountPage runs the actual route loader and Page component through a data router. */
const mountPage = (page = '0') => {
  const router = createMemoryRouter([{ path: '/pages/:nPage/', loader, element: <Page /> }], {
    initialEntries: [`/pages/${page}/`],
  });
  const mounted = render(<RouterProvider router={router} />);
  router.unmountView = mounted.unmount;
  return router;
};

beforeEach(() => {
  vi.clearAllMocks();
  total = 21;
  cache = new Map();
  requests = [];
  languageListener = null;
  getUserLanguage.mockResolvedValue('en_US');
  isForce.mockReturnValue(false);
  jsutils.GetCache.mockImplementation(async (key) => cache.get(key));
  jsutils.SetCache.mockImplementation(async (key, value) => {
    cache.set(key, value);
  });
  jsutils.KvAddListener.mockImplementation(async (_key, listener) => {
    languageListener = listener;
  });
  graphqlQuery.mockImplementation(respond);
  window.scrollTo = vi.fn();
});

describe('bounded list requests', () => {
  it.each([0, 1, 10, 11, 21])('loads only the requested existing page for %s posts', async (count) => {
    total = count;
    const page = Math.max(0, Math.ceil(total / 10) - 1);
    const result = await loader({ params: { nPage: String(page) } });
    await Promise.resolve();
    expect(result.nPosts).toBe(count);
    expect(result.postsData).toHaveLength(count === 0 ? 0 : count - page * 10);
    expect(requests).toEqual(count === 0 ? ['count'] : ['count', page]);
  });
  it.each(['-1', '1.5', 'NaN', 'Infinity', '1tail', ' 1', '9007199254740992'])(
    'rejects invalid route %s without any request',
    async (nPage) => {
      await loader({ params: { nPage } });
      expect(graphqlQuery).not.toHaveBeenCalled();
    }
  );
  it('does not request a page beyond the final page', async () => {
    await loader({ params: { nPage: '3' } });
    expect(requests).toEqual(['count']);
  });
  it('shares concurrent work and retains warm cache hits', async () => {
    const args = { params: { nPage: '1' } };
    await Promise.all([loader(args), loader(args), loader(args)]);
    expect(requests).toEqual(['count', 1]);
    requests = [];
    await loader(args);
    expect(requests).toEqual([]);
  });
  it('uses a cached zero count instead of repeatedly fetching an empty list', async () => {
    total = 0;
    await loader({ params: { nPage: '0' } });
    requests = [];
    await loader({ params: { nPage: '0' } });
    expect(requests).toEqual([]);
  });
  it('bypasses warm caches on explicit force refresh', async () => {
    const args = { params: { nPage: '0' } };
    await loader(args);
    requests = [];
    isForce.mockReturnValue(true);
    await loader(args);
    expect(requests).toEqual(['count', 0]);
  });
  it('renders nine articles without calling a detail loader or fetching the page twice', async () => {
    total = 9;
    const router = mountPage();
    await screen.findByRole('heading', { name: 'Article 8' });
    expect(postLoader).not.toHaveBeenCalled();
    expect(requests).toEqual(['count', 0]);
    router.dispose();
  });
  it('shows an owned foreground failure and recovers on one user retry', async () => {
    graphqlQuery.mockRejectedValueOnce(new Error('private response must not reach UI'));
    const router = mountPage();
    const retry = await screen.findByRole('button', { name: 'Retry loading articles' });
    expect(screen.queryByText(/private response/)).not.toBeInTheDocument();
    fireEvent.click(retry);
    await screen.findByRole('heading', { name: 'Article 0' });
    router.dispose();
  });
  it('revalidates language once and ignores late language notifications after unmount', async () => {
    const router = mountPage();
    await screen.findByRole('heading', { name: 'Article 0' });
    await waitFor(() => expect(languageListener).toBeTypeOf('function'));
    getUserLanguage.mockResolvedValue('zh_CN');
    await act(async () => {
      await languageListener('language', 'set', 'en_US', 'zh_CN');
    });
    await waitFor(() => expect(graphqlQuery.mock.calls.some(([query]) => query.includes('language: zh_CN'))).toBe(true));
    const callCount = graphqlQuery.mock.calls.length;
    router.unmountView();
    router.dispose();
    await act(async () => {
      await languageListener('language', 'set', 'zh_CN', 'en_US');
    });
    expect(graphqlQuery).toHaveBeenCalledTimes(callCount);
    expect(jsutils.KvRemoveListener).toHaveBeenCalled();
  });
});
