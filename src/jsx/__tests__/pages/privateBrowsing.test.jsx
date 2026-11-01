import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../pages/app.jsx';
import { loadPageData } from '../../pages/pagesData.js';
import { Post } from '../../pages/post.jsx';
import { getCurrentUsername, getUserLanguage, graphqlQuery, setUserLanguage } from '../../library/base.jsx';
import jsutils from '@laisky/js-utils';

/** PastStorageDeadline exceeds the storage deadline while staying well below the 15-second page deadline. */
const PastStorageDeadline = { timeout: 5000 };

vi.mock('@laisky/js-utils', () => {
  /** stalled models WebKit private storage, where the database setup never completes or aborts. */
  const stalled = () => new Promise(() => {});
  return {
    default: {
      SHA256: vi.fn(async (value) => value),
      KvGet: vi.fn(stalled),
      KvSet: vi.fn(stalled),
      KvDel: vi.fn(stalled),
      GetCache: vi.fn(stalled),
      SetCache: vi.fn(stalled),
      LoadJsModules: vi.fn(),
    },
  };
});
vi.mock('../../library/base.jsx', async (importOriginal) => ({ ...(await importOriginal()), graphqlQuery: vi.fn() }));
vi.mock('../../components/comments.jsx', () => ({ Comments: () => <aside>Comments area</aside> }));
vi.mock('mermaid', () => ({ default: { run: vi.fn(async () => {}) } }));

/** respond serves local list and article fixtures and never reaches the network. */
const respond = async (body) => {
  if (body.includes('BlogPostInfo')) return { BlogPostInfo: { total: 1 } };
  if (body.includes('ListBlogPosts')) return { BlogPosts: [{ name: 'sample', title: 'Listed sample', markdown: 'Excerpt' }] };
  return {
    BlogPosts: [
      { name: 'sample', title: 'Readable sample', type: 'post', content: '<p>Readable body</p>', menu: '', created_at: '2026-01-01' },
    ],
  };
};

/** mountArticle mounts the real application shell around the real article route. */
const mountArticle = () => {
  const router = createMemoryRouter(
    [{ path: '/', element: <App />, children: [{ path: '/p/:name/', element: <Post isHistory="false" /> }] }],
    { initialEntries: ['/p/sample/'] }
  );
  return render(<RouterProvider router={router} />);
};

beforeEach(() => {
  graphqlQuery.mockReset();
  graphqlQuery.mockImplementation(respond);
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

describe('browser storage that never settles', () => {
  it('still resolves the reader language from the browser', async () => {
    const language = await Promise.race([
      getUserLanguage(),
      new Promise((resolve) => globalThis.setTimeout(() => resolve('stalled'), PastStorageDeadline.timeout)),
    ]);
    expect(language).toBe('en_US');
  }, 10000);

  it('renders the article without either failure message', async () => {
    mountArticle();
    expect(await screen.findByRole('link', { name: 'Readable sample' }, PastStorageDeadline)).toBeInTheDocument();
    expect(screen.getByText('Readable body')).toBeInTheDocument();
    expect(screen.queryByText(/Language preferences are unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/This article could not be loaded/)).not.toBeInTheDocument();
  }, 10000);

  it('loads the article list', async () => {
    const data = await loadPageData({ params: { nPage: '0' } });
    expect(data.problem).toBeUndefined();
    expect(data.postsData.map((post) => post.name)).toEqual(['sample']);
  }, 10000);

  it('applies a language choice for the rest of the session', async () => {
    await setUserLanguage('zh_CN');
    expect(await getUserLanguage()).toBe('zh_CN');
    await setUserLanguage('en_US');
    expect(await getUserLanguage()).toBe('en_US');
  }, 10000);

  it('refreshes an open article when the reader changes language', async () => {
    mountArticle();
    await screen.findByRole('link', { name: 'Readable sample' }, PastStorageDeadline);
    fireEvent.click(document.querySelector('.nav-link.p-2'));
    fireEvent.click(await screen.findByText('zh_CN'));
    await waitFor(() => expect(graphqlQuery.mock.calls.at(-1)[0]).toContain('language: zh_CN'), PastStorageDeadline);
  }, 10000);

  it('never deletes a stored sign-in it could not read', async () => {
    await expect(getCurrentUsername()).resolves.toBeUndefined();
    expect(jsutils.KvDel).not.toHaveBeenCalled();
  }, 10000);
});
