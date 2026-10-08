const html =
  '<h2 id="intro">Safe heading</h2><p><a href="https://example.com/docs">Docs</a><img src="/safe.png" alt="Safe image"></p>' +
  '<pre><code class="language-js">const answer = 42;</code></pre><pre class="mermaid">graph TD; A--&gt;B;</pre>' +
  '<div class="post_series" key="local-series"></div>' +
  '<iframe srcdoc="&lt;script&gt;parent.document.body.dataset.srcdocCanary=1&lt;/script&gt;"></iframe>' +
  '<script async src="/local-canary.js"></script>';
const post = { name: 'local-test', title: 'Local article', content: html, menu: '', created_at: '2026-01-01', arweave_id: [] };
const series = { remark: 'Local', posts: [{ name: 'safe', title: 'Safe series entry' }], children: [] };
/** formatTs accepts no arguments and returns a deterministic display timestamp for local fixtures. */
export const formatTs = () => 'today';
/** ts2UTC accepts no arguments and returns a deterministic UTC label for local fixtures. */
export const ts2UTC = () => 'today';
/** getCurrentUsername accepts no arguments and resolves to an anonymous local fixture identity. */
export const getCurrentUsername = async () => null;
/** getUserLanguage accepts no arguments and resolves to the local fixture language. */
export const getUserLanguage = async () => 'en';
/** isForce accepts no arguments and returns false so the fixture can exercise cache reads. */
export const isForce = () => false;
export const KvKeyLanguage = 'language';
export const KvKeyPrefixCache = 'cache:';
/** graphqlQuery accepts a query and resolves to matching local article or series data without network access. */
export const graphqlQuery = async (query) =>
  query.includes('GetBlogPostSeries') ? { GetBlogPostSeries: [series] } : { BlogPosts: [post], BlogPostHistory: post };
/** Comments accepts no arguments and returns no remote comment widget for the local fixture. */
export const Comments = () => null;
export default {
  /** SHA256 accepts a local cache label and resolves to it unchanged for deterministic cache tests. */
  SHA256: async (value) => value,
  /** GetCache accepts a cache key and resolves to the fixture post only when cache mode is selected. */
  GetCache: async (key) =>
    new URLSearchParams(window.location.search).get('source') === 'cache' && !key.includes('postSeries') ? post : null,
  /** SetCache accepts no arguments and resolves without writing storage in this local fixture. */
  SetCache: async () => {},
  /** KvAddListener accepts no arguments and resolves without attaching remote storage listeners. */
  KvAddListener: async () => {},
  KvOp: { SET: 'set' },
};
