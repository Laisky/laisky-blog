import React from 'react';
import jsutils from '@laisky/js-utils';
import { gql } from 'graphql-request';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookOpen, ChevronRight, FileText } from 'lucide-react';
import { graphqlQuery, isForce, KvKeyPrefixCache } from '../library/base.jsx';
import { runAsyncWork } from '../library/asyncWork.js';

const icons = {
  root: renderToStaticMarkup(<BookOpen size={18} />),
  child: renderToStaticMarkup(<ChevronRight size={16} className="chevron" />),
  post: renderToStaticMarkup(<FileText size={14} />),
};

/** element creates a detached element using only static class names and text-safe dynamic content. */
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** unavailable returns a local, non-sensitive fallback for exactly one failed series branch. */
function unavailable(nested = false) {
  const node = element(nested ? 'li' : 'p', '', 'This series is unavailable.');
  node.setAttribute('role', 'status');
  return node;
}

/** validSeries validates the bounded text and hierarchy required for safe series rendering. */
function validSeries(series) {
  return (
    series &&
    typeof series.remark === 'string' &&
    series.remark.length <= 4096 &&
    (series.posts == null || Array.isArray(series.posts)) &&
    (series.posts || []).length <= 2000 &&
    (series.posts || []).every(
      (post) =>
        post && typeof post.name === 'string' && post.name.length <= 512 && typeof post.title === 'string' && post.title.length <= 4096
    ) &&
    (series.children == null ||
      (Array.isArray(series.children) &&
        series.children.length <= 64 &&
        series.children.every((child) => child && typeof child.key === 'string' && child.key.length > 0 && child.key.length <= 512)))
  );
}

/** loadSeries loads one validated series using its established public cache key without bypassing any article authorization. */
async function loadSeries(key) {
  const cacheKey = KvKeyPrefixCache + (await jsutils.SHA256(`postSeries:${key}`));
  if (!isForce()) {
    const cached = await jsutils.GetCache(cacheKey);
    if (validSeries(cached)) return cached;
  }
  const response = await graphqlQuery(
    gql`
      query ($key: String!) {
        GetBlogPostSeries(key: $key) {
          remark
          posts {
            name
            title
          }
          children {
            key
          }
        }
      }
    `,
    { key }
  );
  const result = response?.GetBlogPostSeries?.[0];
  if (!validSeries(result)) throw new Error('Series is unavailable');
  await jsutils.SetCache(cacheKey, result);
  return result;
}

/** buildSeries renders one bounded branch off-DOM, preserving successful siblings when a child fails. */
async function buildSeries(key, context, ancestors = new Set(), nested = false) {
  if (context.signal?.aborted) return unavailable(nested);
  if (
    typeof key !== 'string' ||
    key.length === 0 ||
    key.length > 512 ||
    ancestors.has(key) ||
    ancestors.size >= 8 ||
    context.remaining <= 0
  ) {
    return unavailable(nested);
  }
  context.remaining -= 1;
  try {
    const series = await runAsyncWork(() => loadSeries(key), { signal: context.signal });
    if (context.signal?.aborted) return unavailable(nested);
    const list = element('ul', 'post-series-list');
    for (const post of series.posts || []) {
      if (context.postsRemaining <= 0) {
        list.append(unavailable(true));
        break;
      }
      context.postsRemaining -= 1;
      const item = element('li', 'post-series-entry');
      const link = element('a', 'post-series-link');
      link.setAttribute('href', `/p/${encodeURIComponent(post.name)}/`);
      link.innerHTML = icons.post;
      link.append(element('span', '', post.title));
      item.append(link);
      list.append(item);
    }
    const path = new Set([...ancestors, key]);
    for (const child of series.children || []) {
      if (context.signal?.aborted) return unavailable(nested);
      list.append(await buildSeries(child.key, context, path, true));
    }
    const title = element(nested ? 'summary' : 'div', nested ? 'series-toggle' : 'post-series-header');
    title.innerHTML = nested ? icons.child : icons.root;
    title.append(element('span', nested ? '' : 'post-series-title', `${series.remark} Serials`));
    if (!nested) {
      const root = element('div', 'post-series');
      root.append(title, list);
      return root;
    }
    const item = element('li', 'post-series-entry post-series-entry--nested');
    const details = element('details', 'series-details');
    const body = element('div', 'series-content');
    body.append(list);
    details.append(title, body);
    item.append(details);
    return item;
  } catch {
    return unavailable(nested);
  }
}

/** parseAndReplacePostSeries owns every root and skips all detached or superseded DOM writes. */
export async function parseAndReplacePostSeries({ root = document.querySelector('#post'), signal } = {}) {
  if (!root || signal?.aborted) return;
  const placeholders = Array.from(root.querySelectorAll('.post-content div.post_series'));
  const context = { signal, remaining: 64, postsRemaining: 2000 };
  await Promise.all(
    placeholders.map(async (placeholder) => {
      const key = placeholder.getAttribute('data-series-key') || placeholder.getAttribute('key');
      const body = await buildSeries(key, context);
      if (!signal?.aborted && placeholder.isConnected && root.contains(placeholder)) placeholder.replaceChildren(body);
    })
  );
}
