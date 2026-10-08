const html =
  '<h2 id="intro">Safe heading</h2><p><a href="https://example.com/docs">Docs</a><img src="/safe.png" alt="Safe image"></p>' +
  '<pre><code class="language-js">const answer = 42;</code></pre><pre class="mermaid">graph TD; A--&gt;B;</pre>' +
  '<div class="post_series" key="local-series"></div>' +
  '<iframe srcdoc="&lt;script&gt;parent.document.body.dataset.srcdocCanary=1&lt;/script&gt;"></iframe>' +
  '<script async src="/local-canary.js"></script>';
const post = { name: 'local-test', title: 'Local article', content: html, menu: '', created_at: '2026-01-01', arweave_id: [] };
const series = { remark: 'Local', posts: [{ name: 'safe', title: 'Safe series entry' }], children: [] };
export const formatTs = () => 'today';
export const ts2UTC = () => 'today';
export const getCurrentUsername = async () => null;
export const getUserLanguage = async () => 'en';
export const isForce = () => false;
export const KvKeyLanguage = 'language';
export const KvKeyPrefixCache = 'cache:';
export const graphqlQuery = async (query) =>
  query.includes('GetBlogPostSeries') ? { GetBlogPostSeries: [series] } : { BlogPosts: [post], BlogPostHistory: post };
export const Comments = () => null;
export default {
  SHA256: async (value) => value,
  GetCache: async (key) =>
    new URLSearchParams(window.location.search).get('source') === 'cache' && !key.includes('postSeries') ? post : null,
  SetCache: async () => {},
  KvAddListener: async () => {},
  KvOp: { SET: 'set' },
};
