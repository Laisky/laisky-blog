import React from 'react';
import jsutils from '@laisky/js-utils';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUsername, graphqlMutation, graphqlQuery } from '../../library/base.jsx';
import { kvSet } from '../../library/storage.js';
import { Categories } from '../../pages/categories.jsx';
import { PostEdit } from '../../pages/edit.jsx';
import { Manage } from '../../pages/manage.jsx';
import { Page, loader as pageLoader } from '../../pages/pages.jsx';
import { Post } from '../../pages/post.jsx';

vi.mock('@laisky/js-utils', () => ({
  default: {
    SHA256: vi.fn(async (value) => value),
    KvGet: vi.fn(async () => null),
    KvSet: vi.fn(),
    KvDel: vi.fn(async () => {}),
    GetCache: vi.fn(async () => null),
    SetCache: vi.fn(async () => {}),
    LoadJsModules: vi.fn(),
    formatRelativeTime: () => 'now',
  },
}));
vi.mock('../../library/base.jsx', async (importOriginal) => ({
  ...(await importOriginal()),
  graphqlQuery: vi.fn(),
  graphqlMutation: vi.fn(),
  getCurrentUsername: vi.fn(async () => 'admin'),
}));
vi.mock('../../components/comments.jsx', () => ({ Comments: () => <aside>Comments</aside> }));
vi.mock('../../components/sidebar.jsx', () => ({ Sidebar: () => <aside>Sidebar</aside> }));
vi.mock('mermaid', () => ({ default: { run: vi.fn(async () => {}) } }));

const article = {
  name: 'sample',
  title: 'Sample title',
  type: 'post',
  content: '<p>Body</p>',
  markdown: 'm',
  menu: '',
  created_at: '2026-01-01',
};

/** respond serves the local fixture each page under test requests. */
const respond = async (query) => {
  if (query.includes('BlogPostInfo')) return { BlogPostInfo: { total: 1 } };
  if (query.includes('BlogPostCategories')) return { BlogPostCategories: [{ name: 'General', url: 'general' }] };
  if (query.includes('ListBlogPosts'))
    return { BlogPosts: [{ name: 'listed', title: 'Listed', markdown: 'Excerpt', created_at: '2026-01-01' }] };
  if (query.includes('$name')) return { BlogPosts: [article] };
  return { BlogPosts: [{ ...article, name: 'p-0', title: 'Post 0', category: { name: 'General', url: 'general' } }] };
};

/** queriesFor counts the GraphQL queries sent in one language. */
const queriesFor = (language) => graphqlQuery.mock.calls.filter(([query]) => query.includes(`language: ${language}`)).length;

/** changeLanguage writes a language through the real storage path and lets subscribers finish. */
const changeLanguage = async (language) => {
  await act(async () => {
    await kvSet('language', language);
    await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
  });
};

/** mount renders one route through the real router, optionally under StrictMode. */
const mount = (path, element, entry, { strict = false, loader } = {}) => {
  const router = createMemoryRouter([{ path, element, loader }], { initialEntries: [entry] });
  const view = <RouterProvider router={router} />;
  return { router, ...render(strict ? <React.StrictMode>{view}</React.StrictMode> : view) };
};

/** fillPublishForm completes the required editor fields. */
const fillPublishForm = () => {
  fireEvent.change(document.querySelector('#postTitle'), { target: { value: 'Title' } });
  fireEvent.change(document.querySelector('#postName'), { target: { value: 'name' } });
  fireEvent.change(document.querySelector('#postMarkdown'), { target: { value: 'Body' } });
};

/** submitBatch selects every post and applies a category. */
const submitBatch = async () => {
  await screen.findByText('Post 0');
  fireEvent.click(document.querySelector('.manage-toolbar input[type="checkbox"]'));
  fireEvent.change(document.querySelector('.manage-toolbar select'), { target: { value: 'general' } });
  fireEvent.click(document.querySelector('.manage-toolbar button'));
};

beforeEach(async () => {
  jsutils.KvSet.mockReset();
  jsutils.KvSet.mockRejectedValue(new Error('storage outage'));
  jsutils.KvGet.mockReset();
  jsutils.KvGet.mockResolvedValue(null);
  graphqlQuery.mockReset();
  graphqlQuery.mockImplementation(respond);
  graphqlMutation.mockReset();
  graphqlMutation.mockResolvedValue({});
  getCurrentUsername.mockResolvedValue('admin');
  window.MathJax = { Hub: { Queue: vi.fn() } };
  window.scrollTo = vi.fn();
  await kvSet('language', 'en_US');
});

describe('language changes reach only pages that are open', () => {
  it.each([[false], [true]])('an article follows a change during an outage (StrictMode: %s)', async (strict) => {
    mount('/p/:name/', <Post isHistory="false" />, '/p/sample/', { strict });
    await screen.findByRole('link', { name: 'Sample title' });
    await changeLanguage('zh_CN');
    await waitFor(() => expect(queriesFor('zh_CN')).toBeGreaterThan(0));
  });

  it.each([[false], [true]])('a list follows a change during an outage (StrictMode: %s)', async (strict) => {
    mount('/pages/:nPage/', <Page />, '/pages/0/', { strict, loader: pageLoader });
    await screen.findByRole('link', { name: 'Listed' });
    await changeLanguage('zh_CN');
    await waitFor(() => expect(queriesFor('zh_CN')).toBeGreaterThan(0));
  });

  it('a change revalidates a list once', async () => {
    mount('/pages/:nPage/', <Page />, '/pages/0/', { loader: pageLoader });
    await screen.findByRole('link', { name: 'Listed' });
    await changeLanguage('zh_CN');
    await waitFor(() => expect(queriesFor('zh_CN')).toBeGreaterThan(0));
    const settled = queriesFor('zh_CN');
    await changeLanguage('zh_CN');
    expect(queriesFor('zh_CN')).toBe(settled);
  });

  it('a category page reloads while open and stops once left', async () => {
    const { unmount } = mount('/categories/:category', <Categories />, '/categories/general');
    await waitFor(() => expect(graphqlQuery).toHaveBeenCalled());
    await changeLanguage('zh_CN');
    await waitFor(() => expect(queriesFor('zh_CN')).toBeGreaterThan(0));
    unmount();
    const before = graphqlQuery.mock.calls.length;
    await changeLanguage('en_US');
    expect(graphqlQuery.mock.calls.length).toBe(before);
  });

  it('an editor reloads while open and stops once left', async () => {
    const { router, unmount } = mount('/publish/', <PostEdit isPublish="true" />, '/publish/');
    await screen.findByRole('button', { name: 'Publish' });
    const navigate = vi.spyOn(router, 'navigate');
    await changeLanguage('zh_CN');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(0));
    unmount();
    navigate.mockClear();
    await changeLanguage('en_US');
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('privileged requests need a readable sign-in', () => {
  it('publishing with no sign-in sends nothing and explains why', async () => {
    mount('/publish/', <PostEdit isPublish="true" />, '/publish/');
    const publish = await screen.findByRole('button', { name: 'Publish' });
    fillPublishForm();
    fireEvent.click(publish);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to publish: Sign in is required.');
    expect(graphqlMutation).not.toHaveBeenCalled();
  });

  it('shows a validation error for an empty required field', async () => {
    mount('/publish/', <PostEdit isPublish="true" />, '/publish/');
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Required field is empty: title');
  });

  it('a second click while publishing sends one request', async () => {
    jsutils.KvGet.mockImplementation(async (key) => (key === 'user_token' ? 'stored-token' : null));
    let finish;
    graphqlMutation.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    mount('/publish/', <PostEdit isPublish="true" />, '/publish/');
    const publish = await screen.findByRole('button', { name: 'Publish' });
    fillPublishForm();
    fireEvent.click(publish);
    await waitFor(() => expect(graphqlMutation).toHaveBeenCalledOnce());
    await screen.findByRole('button', { name: 'Publishing...' });
    fireEvent.click(screen.getByRole('button', { name: 'Publishing...' }));
    await act(async () => new Promise((resolve) => globalThis.setTimeout(resolve, 20)));
    expect(graphqlMutation).toHaveBeenCalledOnce();
    await act(async () => finish({}));
  });

  it('keeps edited text when a later render happens', async () => {
    mount('/publish/', <PostEdit isPublish="true" />, '/publish/');
    const publish = await screen.findByRole('button', { name: 'Publish' });
    fireEvent.change(document.querySelector('#postMarkdown'), { target: { value: 'Draft in progress' } });
    fireEvent.click(publish);
    await screen.findByRole('alert');
    expect(document.querySelector('#postMarkdown').value).toBe('Draft in progress');
  });

  it('publishing while the token is unreadable sends nothing', async () => {
    jsutils.KvGet.mockRejectedValue(new Error('storage outage'));
    mount('/publish/', <PostEdit isPublish="true" />, '/publish/');
    const publish = await screen.findByRole('button', { name: 'Publish' });
    fillPublishForm();
    fireEvent.click(publish);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to publish');
    expect(graphqlMutation).not.toHaveBeenCalled();
  });

  it('publishing sends the stored token', async () => {
    jsutils.KvGet.mockImplementation(async (key) => (key === 'user_token' ? 'stored-token' : null));
    mount('/publish/', <PostEdit isPublish="true" />, '/publish/');
    const publish = await screen.findByRole('button', { name: 'Publish' });
    fillPublishForm();
    fireEvent.click(publish);
    await waitFor(() => expect(graphqlMutation).toHaveBeenCalled());
    expect(graphqlMutation.mock.calls[0][2]).toEqual({ Authorization: 'Bearer stored-token' });
  });

  it('a batch with no sign-in stops before any request', async () => {
    mount('/admin', <Manage />, '/admin');
    await submitBatch();
    expect(await screen.findByText(/Batch update failed: Sign in is required/)).toBeInTheDocument();
    expect(graphqlMutation).not.toHaveBeenCalled();
  });

  it('a batch sends the stored token', async () => {
    jsutils.KvGet.mockImplementation(async (key) => (key === 'user_token' ? 'stored-token' : null));
    mount('/admin', <Manage />, '/admin');
    await submitBatch();
    await waitFor(() => expect(graphqlMutation).toHaveBeenCalled());
    expect(JSON.stringify(graphqlMutation.mock.calls)).toContain('Bearer stored-token');
  });
});
