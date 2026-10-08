import React from 'react';
import jsutils from '@laisky/js-utils';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Post } from '../../pages/post.jsx';
import { sanitizeArticleHtml } from '../../library/articleHtml.js';
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
vi.mock('mermaid', () => ({ default: { run: vi.fn(), initialize: vi.fn() } }));

const activeHtml =
  '<h2 id="safe">Safe heading</h2><iframe srcdoc="&lt;script&gt;parent.document.body.dataset.srcdocCanary=1&lt;/script&gt;"></iframe>' +
  '<script async src="/local-canary.js"></script><object data="/local"></object><embed src="/local">' +
  '<base href="/local"><link rel="stylesheet" href="/local"><meta http-equiv="refresh" content="0;url=/local">' +
  '<form action="/local"><input name="value"></form><style>body{display:none}</style>' +
  '<svg onload="alert(1)"><a href="javascript:alert(1)">bad</a></svg><math><mi>bad</mi></math>' +
  '<x-canary onclick="alert(1)">custom</x-canary><a href="javascript:alert(1)">bad URL</a>' +
  '<img src="data:image/svg+xml,bad" onerror="alert(1)" alt="unsafe"><template><script>bad</script></template>';

/** createPost returns a mock article with the supplied HTML content and no real account data. */
const createPost = (content) => ({
  name: 'local-test',
  title: 'Local article',
  content,
  menu: '',
  created_at: '2026-01-01',
  arweave_id: [],
});

/** renderPost renders the actual article component in the requested local route mode. */
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

describe('article HTML render boundary', () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('rejects active content for history=%s cache=%s', async (history, cached) => {
    const post = createPost(activeHtml);
    if (cached) jsutils.GetCache.mockResolvedValue(post);
    graphqlQuery.mockResolvedValue({ BlogPosts: [post], BlogPostHistory: post });
    const { container } = renderPost(history);
    await screen.findByText('Safe heading');
    const article = container.querySelector('.post-content');
    expect(article.querySelector('iframe,script,object,embed,base,link,meta,form,input,style,svg,math,x-canary,template')).toBeNull();
    expect(article.innerHTML).not.toMatch(/onerror|onclick|javascript:|data:image/);
    if (cached) expect(graphqlQuery).not.toHaveBeenCalled();
  });

  it('keeps generated series data as text and confines post names to URL paths', async () => {
    const title = '<style>body{display:none}</style><iframe srcdoc="bad"></iframe>';
    const series = { remark: title, posts: [{ name: '" onclick="bad', title }], children: [] };
    graphqlQuery.mockImplementation(async (query) =>
      query.includes('GetBlogPostSeries')
        ? { GetBlogPostSeries: [series] }
        : { BlogPosts: [createPost('<div class="post_series" key="local"></div>')] }
    );
    const { container } = renderPost(false);
    await waitFor(() => expect(container.querySelector('.post-series-link')).not.toBeNull());
    const link = container.querySelector('.post-series-link');
    expect(link).toHaveTextContent(title);
    expect(link.getAttribute('href')).toBe('https://blog.laisky.com/p/%22%20onclick%3D%22bad/');
    expect(container.querySelector('.post-series-title')).toHaveTextContent(`${title} Serials`);
    expect(container.querySelector('.post-series svg')).not.toBeNull();
    expect(container.querySelector('.post-series iframe, .post-series style, .post-series [onclick]')).toBeNull();
  });

  it('preserves headings, links, image viewing, code, series keys, and diagram source', async () => {
    const post = createPost(
      '<h2 id="intro">Introduction</h2><p><a href="https://example.com/docs">Docs</a>' +
        '<img src="/safe.png" alt="Safe image"></p><pre><code class="language-js">const answer = 42;</code></pre>' +
        '<pre class="mermaid">graph TD; A--&gt;B;</pre><div class="post_series" key="local-series"></div>'
    );
    graphqlQuery.mockImplementation(async (query) =>
      query.includes('GetBlogPostSeries') ? { GetBlogPostSeries: [] } : { BlogPosts: [post] }
    );
    const { container } = renderPost(false);
    await screen.findByRole('heading', { name: 'Introduction' });
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', 'https://example.com/docs');
    expect(screen.getByAltText('Safe image')).toHaveAttribute('loading', 'lazy');
    expect(container.querySelector('.code-block-container')).not.toBeNull();
    expect(container.querySelector('pre.mermaid')).toHaveTextContent('graph TD; A-->B;');
    await waitFor(() => expect(graphqlQuery).toHaveBeenCalledWith(expect.stringContaining('GetBlogPostSeries'), { key: 'local-series' }));
  });
});

describe('article formatting policy', () => {
  it('rejects resource schemes and malformed URLs without rejecting safe links', () => {
    const html = sanitizeArticleHtml(
      '<a href="mailto:local@example.com">Email</a><a href="tel:+123">Call</a>' +
        '<a href="/docs">Relative</a><a href="#heading">Heading</a><a href="http://[">Invalid</a>' +
        '<a href="java&#x09;script:alert(1)">Script</a><a href="data:text/html,bad">Data</a>' +
        '<img src="data:image/png,bad"><img src="ftp://example.com/image">'
    );
    const { container } = render(<div dangerouslySetInnerHTML={{ __html: html }} />);
    expect(screen.getByText('Email')).toHaveAttribute('href', 'mailto:local@example.com');
    expect(screen.getByText('Call')).toHaveAttribute('href', 'tel:+123');
    expect(screen.getByText('Relative')).toHaveAttribute('href', '/docs');
    expect(screen.getByText('Heading')).toHaveAttribute('href', '#heading');
    for (const label of ['Invalid', 'Script', 'Data']) expect(screen.getByText(label)).not.toHaveAttribute('href');
    expect(container.querySelector('img[src]')).toBeNull();
  });

  it('preserves safe structural formatting without style or arbitrary data attributes', () => {
    const html = sanitizeArticleHtml(
      '<details><summary>More</summary><table><tbody><tr><th scope="col">Title</th>' +
        '<td colspan="2">Value</td></tr></tbody></table></details><p style="display:none" data-other="bad">Text</p>'
    );
    const { container } = render(<div dangerouslySetInnerHTML={{ __html: html }} />);
    expect(container.querySelector('summary')).toHaveTextContent('More');
    expect(container.querySelector('td')).toHaveAttribute('colspan', '2');
    expect(container.querySelector('[style], [data-other]')).toBeNull();
  });
});
