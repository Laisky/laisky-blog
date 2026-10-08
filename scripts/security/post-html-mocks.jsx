const html =
  '<h2 id="intro">Author heading</h2><section class="slides" style="color:blue"><p><a href="https://example.test/docs">Docs</a><img src="/safe.png" alt="Safe image"></p>' +
  '<pre><code class="language-js">const answer = 42;</code></pre><pre class="mermaid">graph TD; A--&gt;B;</pre>' +
  '<div class="post_series" key="local-series"></div><video controls src="/local.mp4"></video><svg><path d="M0 0"></path></svg><math><mi>x</mi></math>' +
  '<iframe title="Authored embed" srcdoc="&lt;script&gt;parent.document.body.dataset.authoredCanary=1&lt;/script&gt;"></iframe></section>';
const post = {
  name: 'local-test',
  title: 'Author slide',
  type: 'slide',
  content: html,
  menu: '',
  created_at: '2026-01-01',
  arweave_id: [],
};
const foreign = {
  ...post,
  content:
    '<h2>Foreign cached body</h2><iframe srcdoc="&lt;script&gt;parent.document.body.dataset.foreignCanary=1&lt;/script&gt;"></iframe>',
};
const series = { remark: 'Local', posts: [{ name: 'safe', title: 'Safe series entry' }], children: [] };
/** formatTs accepts no arguments and returns a deterministic display timestamp. */
export const formatTs = () => 'today';
/** ts2UTC accepts no arguments and returns a deterministic UTC label. */
export const ts2UTC = () => 'today';
/** getCurrentUsername resolves to an anonymous local fixture identity. */
export const getCurrentUsername = async () => null;
/** getUserLanguage resolves to the local fixture language. */
export const getUserLanguage = async () => 'en';
/** isForce returns false to exercise cache behavior. */
export const isForce = () => false;
export const KvKeyLanguage = 'language';
export const KvKeyPrefixCache = 'cache:';
/** graphqlQuery supplies only local fixtures, rejecting historical bodies whose server authorization is denied. */
export const graphqlQuery = async (query) => {
  if (query.includes('GetBlogPostSeries')) return { GetBlogPostSeries: [series] };
  if (query.includes('BlogPostHistory')) {
    window.historyChecks = (window.historyChecks || 0) + 1;
    if (new URLSearchParams(window.location.search).get('authorization') === 'deny') {
      throw new Error('local archive authorization denied');
    }
  }
  return { BlogPosts: [post], BlogPostHistory: post };
};
/** Comments returns no external comment widget. */
export const Comments = () => null;
export default {
  /** SHA256 returns its local cache label unchanged. */
  SHA256: async (value) => value,
  /** GetCache supplies a stale foreign body for history and an authored body for live cache controls. */
  GetCache: async (key) => {
    if (new URLSearchParams(window.location.search).get('source') !== 'cache' || key.includes('postSeries')) return null;
    return key.includes('postHistory') ? foreign : post;
  },
  /** SetCache performs no persistent storage write. */
  SetCache: async () => {},
  /** KvAddListener attaches no external storage listener. */
  KvAddListener: async () => {},
  KvOp: { SET: 'set' },
};
