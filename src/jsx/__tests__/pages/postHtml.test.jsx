import React from 'react';
import jsutils from '@laisky/js-utils';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Post, historyLoader, loader } from '../../pages/post.jsx';
import { graphqlQuery } from '../../library/base.jsx';

vi.mock('@laisky/js-utils', () => ({
  default: {
    SHA256: vi.fn(async (value) => value),
    GetCache: vi.fn(),
    SetCache: vi.fn(),
    KvAddListener: vi.fn(),
    KvOp: { SET: 'set' },
  },
}));
vi.mock('../../library/base.jsx', () => ({
  formatTs: () => 'today',
  ts2UTC: () => 'today',
  getCurrentUsername: vi.fn(),
  getUserLanguage: async () => 'en',
  graphqlQuery: vi.fn(),
  isForce: () => false,
  KvKeyLanguage: 'language',
  KvKeyPrefixCache: 'cache:',
}));
vi.mock('../../components/comments.jsx', () => ({ Comments: () => null }));
vi.mock('mermaid', () => ({ default: { run: vi.fn() } }));

/** createPost returns an entirely local authored Slide fixture with the supplied body. */
const createPost = (content) => ({
  name: 'local-test',
  title: 'Author slide',
  type: 'slide',
  content,
  menu: '',
  created_at: '2026-01-01',
  arweave_id: [],
});

/** renderPost mounts the actual article renderer in a local live or historical route. */
const renderPost = (history) =>
  render(
    <MemoryRouter initialEntries={['/p/local-test/']}>
      <Routes>
        <Route path="/p/:name/" element={<Post isHistory={history ? 'true' : 'false'} />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.MathJax = { Hub: { Queue: vi.fn() } };
  jsutils.GetCache.mockResolvedValue(null);
});

describe('history publication authorization', () => {
  it.each([false, true])('rejects foreign history even with a legacy cached body=%s', async (cached) => {
    if (cached) jsutils.GetCache.mockResolvedValue(createPost('<iframe srcdoc="foreign canary"></iframe>'));
    graphqlQuery.mockRejectedValue(new Error('post history archive is not registered'));
    await expect(historyLoader({ params: { name: 'foreign-id' } })).rejects.toThrow('not registered');
    expect(graphqlQuery).toHaveBeenCalledWith(expect.stringContaining('BlogPostHistory'), { fileId: 'foreign-id' });
    expect(jsutils.GetCache).not.toHaveBeenCalled();
    expect(jsutils.SetCache).not.toHaveBeenCalled();
  });

  it.each([false, true])('uses the freshly authorized archive instead of stale historical cache=%s', async (cached) => {
    const authorized = createPost('<iframe src="/authored-embed"></iframe>');
    if (cached) jsutils.GetCache.mockResolvedValue(createPost('stale foreign body'));
    graphqlQuery.mockResolvedValue({ BlogPostHistory: authorized });
    await expect(historyLoader({ params: { name: 'registered-id' } })).resolves.toBe(authorized);
    expect(graphqlQuery).toHaveBeenCalledWith(expect.stringContaining('BlogPostHistory'), { fileId: 'registered-id' });
    expect(jsutils.GetCache).not.toHaveBeenCalled();
  });

  it('preserves current article caching', async () => {
    const cached = createPost('Current cached body');
    jsutils.GetCache.mockResolvedValue(cached);
    await expect(loader({ params: { name: 'local-test' } })).resolves.toBe(cached);
    expect(graphqlQuery).not.toHaveBeenCalled();
  });
});

describe('authored article compatibility', () => {
  it.each([false, true])('preserves established authored Slide HTML for history=%s', async (history) => {
    const authored = createPost(
      '<h2>Author heading</h2><section class="slides" style="color:blue"><iframe title="Authored embed" srcdoc="<p>Authored slide</p>"></iframe><video controls src="/local.mp4"></video><svg><path d="M0 0"></path></svg><math><mi>x</mi></math></section>'
    );
    graphqlQuery.mockResolvedValue({ BlogPosts: [authored], BlogPostHistory: authored });
    const { container } = renderPost(history);
    await screen.findByRole('heading', { name: 'Author heading' });
    expect(screen.getByTitle('Authored embed')).toHaveAttribute('srcdoc', '<p>Authored slide</p>');
    expect(container.querySelector('.slides')).toHaveAttribute('style', 'color: blue;');
    expect(container.querySelector('video')).toHaveAttribute('controls');
    expect(container.querySelector('.post-content svg path')).not.toBeNull();
    expect(container.querySelector('math mi')).toHaveTextContent('x');
  });
});

/** HistoryNavigation gives route-transition regressions a real router control. */
const HistoryNavigation = () => {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/p/foreign-id/')}>Other archive</button>;
};

/** renderHistoryNavigation keeps the same Post instance mounted across history routes. */
const renderHistoryNavigation = () =>
  render(
    <MemoryRouter initialEntries={['/p/local-test/']}>
      <HistoryNavigation />
      <Routes>
        <Route path="/p/:name/" element={<Post isHistory="true" />} />
      </Routes>
    </MemoryRouter>
  );

describe('historical authorization lifecycle', () => {
  it('shows a safe unavailable state when historical authorization is denied', async () => {
    graphqlQuery.mockRejectedValue(new Error('<iframe>untrusted server error</iframe>'));
    const { container } = renderPost(true);
    await screen.findByText('This historical article is unavailable.');
    expect(container.querySelector('.post-content, iframe, #post-menu')).toBeNull();
    expect(screen.queryByText(/untrusted server error/)).not.toBeInTheDocument();
  });

  it('clears previous historical body and menu while the next archive is checked', async () => {
    let rejectNext;
    const next = new Promise((_resolve, reject) => {
      rejectNext = reject;
    });
    const first = { ...createPost('<h2>First authorized body</h2>'), menu: '<a href="#first">Previous menu</a>' };
    graphqlQuery.mockImplementation(async (_query, variables) => (variables.fileId === 'foreign-id' ? next : { BlogPostHistory: first }));
    const { container } = renderHistoryNavigation();
    await screen.findByText('First authorized body');
    expect(container.querySelector('#post-menu')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Other archive' }));
    await screen.findByText('Loading historical article…');
    expect(screen.queryByText('First authorized body')).not.toBeInTheDocument();
    expect(container.querySelector('#post-menu')).toBeNull();
    rejectNext(new Error('not registered'));
    await screen.findByText('This historical article is unavailable.');
    expect(container.querySelector('.post-content')).toBeNull();
  });

  it('ignores an obsolete historical result after a newer route has been authorized', async () => {
    let resolveFirst;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    graphqlQuery.mockImplementation(async (_query, variables) =>
      variables.fileId === 'foreign-id' ? { BlogPostHistory: createPost('<h2>Current authorized body</h2>') } : first
    );
    renderHistoryNavigation();
    await waitFor(() => expect(graphqlQuery).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Other archive' }));
    await screen.findByText('Current authorized body');
    resolveFirst({ BlogPostHistory: createPost('<h2>Obsolete foreign body</h2>') });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('Obsolete foreign body')).not.toBeInTheDocument();
    expect(screen.getByText('Current authorized body')).toBeInTheDocument();
  });
});
