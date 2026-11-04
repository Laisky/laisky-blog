import React from 'react';
import jsutils from '@laisky/js-utils';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { graphqlQuery, KvKeyLanguage } from '../../library/base.jsx';
import { App } from '../../pages/app.jsx';
import { Post } from '../../pages/post.jsx';

vi.mock('@laisky/js-utils', () => ({
  default: {
    SHA256: vi.fn(async (value) => value),
    KvGet: vi.fn(),
    KvSet: vi.fn(async () => {}),
    KvDel: vi.fn(async () => {}),
    GetCache: vi.fn(async () => null),
    SetCache: vi.fn(async () => {}),
    LoadJsModules: vi.fn(),
  },
}));
vi.mock('../../library/base.jsx', async (importOriginal) => ({ ...(await importOriginal()), graphqlQuery: vi.fn() }));
vi.mock('../../components/comments.jsx', () => ({ Comments: () => <aside>Comments area</aside> }));
vi.mock('mermaid', () => ({ default: { run: vi.fn(async () => {}) } }));

/** mountArticle mounts the real application shell around the real article route. */
const mountArticle = () => {
  const route = { path: '/p/:name/', element: <Post isHistory="false" /> };
  const router = createMemoryRouter([{ path: '/', element: <App />, children: [route] }], { initialEntries: ['/p/sample/'] });
  return render(<RouterProvider router={router} />);
};

/** storeLanguage makes browser storage hold one language value. */
const storeLanguage = (value) => {
  jsutils.KvGet.mockImplementation(async (key) => (key === KvKeyLanguage ? value : null));
};

beforeEach(() => {
  graphqlQuery.mockReset();
  graphqlQuery.mockResolvedValue({
    BlogPosts: [
      { name: 'sample', title: 'Readable sample', type: 'post', content: '<p>Readable body</p>', menu: '', created_at: '2026-01-01' },
    ],
  });
  jsutils.KvSet.mockClear();
  const append = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
    const result = append(node);
    if (node.tagName === 'SCRIPT') globalThis.queueMicrotask(() => node.dispatchEvent(new globalThis.Event('load')));
    return result;
  });
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('zh-TW');
  window.MathJax = { Hub: { Queue: vi.fn() } };
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  window.scrollTo = vi.fn();
  window.dataLayer = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

it.each([[123], [true], [{ language: 'zh_CN' }], [['zh_CN']]])(
  'a corrupted stored language %j leaves the article readable and is repaired',
  async (stored) => {
    storeLanguage(stored);
    mountArticle();
    expect(await screen.findByRole('link', { name: 'Readable sample' })).toBeInTheDocument();
    expect(screen.queryByText(/Language preferences are unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/This article could not be loaded/)).not.toBeInTheDocument();
    expect(graphqlQuery.mock.calls[0][0]).toContain('language: en_US');
    await waitFor(() => expect(jsutils.KvSet).toHaveBeenCalledWith(KvKeyLanguage, 'en_US'));
  }
);

it('a valid stored language is kept and not rewritten as English', async () => {
  storeLanguage('zh_CN');
  mountArticle();
  await screen.findByRole('link', { name: 'Readable sample' });
  expect(graphqlQuery.mock.calls[0][0]).toContain('language: zh_CN');
  await waitFor(() => expect(jsutils.KvSet).toHaveBeenCalledWith(KvKeyLanguage, 'zh_CN'));
  expect(jsutils.KvSet).not.toHaveBeenCalledWith(KvKeyLanguage, 'en_US');
});
