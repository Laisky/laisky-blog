'use strict';

import jsutils from '@laisky/js-utils';
import { gql } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  formatTs,
  getCurrentUsername,
  getUserLanguage,
  graphqlMutation,
  graphqlQuery,
  KvKeyUserToken,
} from '../library/base.jsx';

/**
 * loadAllPosts fetches all posts with category info for management.
 *
 * @returns {Promise<Array>} Array of post objects sorted by created_at desc.
 */
const loadAllPosts = async () => {
  const gqBody = gql`
    query {
      BlogPosts(
        language: ${await getUserLanguage()}
        page: { page: 0, size: 9999 }
      ) {
        name
        title
        created_at
        category {
          name
          url
        }
      }
    }
  `;

  const resp = await graphqlQuery(gqBody);
  return resp.BlogPosts;
};

/**
 * loadCategories fetches all available categories.
 *
 * @returns {Promise<Array>} Array of category objects.
 */
const loadCategories = async () => {
  const gqBody = gql`
    query {
      BlogPostCategories {
        name
        url
      }
    }
  `;

  const resp = await graphqlQuery(gqBody);
  return resp.BlogPostCategories;
};

/**
 * amendPostCategory updates a single post's category via GraphQL mutation.
 *
 * @param {string} postName - The post name identifier.
 * @param {string} categoryUrl - The new category URL.
 * @param {string} token - JWT auth token.
 * @returns {Promise<void>}
 */
const amendPostCategory = async (postName, categoryUrl, token) => {
  const language = await getUserLanguage();

  // Try with category_url first, fall back to category
  const mutations = [
    gql`
      mutation($post: NewBlogPost!) {
        BlogAmendPost(post: $post, language: ${language}) {
          name
        }
      }
    `,
  ];

  const candidates = [
    { name: postName, category_url: categoryUrl },
    { name: postName, category: categoryUrl },
  ];

  let lastErr;
  for (const candidate of candidates) {
    try {
      await graphqlMutation(mutations[0], { post: candidate }, {
        Authorization: `Bearer ${token}`,
      });
      return;
    } catch (err) {
      lastErr = err;
      const text = `${err?.message || ''}`.toLowerCase();
      if (
        text.includes('is not defined by type') ||
        text.includes('unknown argument') ||
        text.includes('unknown field') ||
        text.includes('unknown input field')
      ) {
        continue;
      }
      throw err;
    }
  }

  if (lastErr) throw lastErr;
};

export const Manage = () => {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState(new Set());
  const [batchCategory, setBatchCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const username = await getCurrentUsername();
      if (!username) {
        navigate('/');
        return;
      }
      setIsAuthed(true);

      const [postsData, categoriesData] = await Promise.all([loadAllPosts(), loadCategories()]);
      setPosts(postsData);
      setCategories(categoriesData);
      setIsLoading(false);
    })();
  }, [navigate]);

  const toggleSelect = (postName) => {
    setSelectedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postName)) {
        next.delete(postName);
      } else {
        next.add(postName);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map((p) => p.name)));
    }
  };

  const handleBatchUpdate = async () => {
    if (!batchCategory || selectedPosts.size === 0) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const token = await jsutils.KvGet(KvKeyUserToken);
      let successCount = 0;
      let failCount = 0;

      for (const postName of selectedPosts) {
        try {
          await amendPostCategory(postName, batchCategory, token);
          successCount++;
        } catch {
          failCount++;
        }
      }

      // Refresh post list
      const postsData = await loadAllPosts();
      setPosts(postsData);
      setSelectedPosts(new Set());

      if (failCount === 0) {
        setSubmitResult({ type: 'success', message: `Updated ${successCount} post(s) successfully.` });
      } else {
        setSubmitResult({
          type: 'danger',
          message: `Updated ${successCount} post(s), ${failCount} failed.`,
        });
      }
    } catch (err) {
      setSubmitResult({ type: 'danger', message: `Batch update failed: ${err?.message || 'Unknown error'}` });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthed) return null;

  return (
    <div className="scrollable-content">
      <div id="manage" className="row g-3 g-xl-4 align-items-start">
        <div className="col-12 col-xl-9 posts">
          <header className="page-heading">
            <h1>Manage Posts</h1>
            <p>{isLoading ? 'Loading...' : `${posts.length} post${posts.length === 1 ? '' : 's'}`}</p>
          </header>

          {isLoading && (
            <div className="section-card placeholder-glow">
              <span className="placeholder col-8"></span>
              <span className="placeholder col-6"></span>
              <span className="placeholder col-5"></span>
            </div>
          )}

          {!isLoading && (
            <>
              {/* Batch action bar */}
              <div className="manage-toolbar">
                <label className="manage-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedPosts.size === posts.length && posts.length > 0}
                    onChange={toggleSelectAll}
                  />
                  <span>
                    {selectedPosts.size > 0 ? `${selectedPosts.size} selected` : 'Select all'}
                  </span>
                </label>

                <div className="manage-batch-action">
                  <select
                    className="form-select manage-category-select"
                    value={batchCategory}
                    onChange={(e) => setBatchCategory(e.target.value)}
                  >
                    <option value="">Set category...</option>
                    {categories.map((cat) => (
                      <option key={cat.url} value={cat.url}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

                  <button
                    className="btn btn-primary"
                    disabled={submitting || !batchCategory || selectedPosts.size === 0}
                    onClick={handleBatchUpdate}
                  >
                    {submitting ? 'Updating...' : 'Apply'}
                  </button>
                </div>
              </div>

              {submitResult && (
                <div className={`alert alert-${submitResult.type} mb-3`} role="alert">
                  {submitResult.message}
                </div>
              )}

              {/* Post list */}
              <div className="manage-list">
                {posts.map((post) => (
                  <div
                    className={`manage-item ${selectedPosts.has(post.name) ? 'manage-item--selected' : ''}`}
                    key={post.name}
                  >
                    <label className="manage-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedPosts.has(post.name)}
                        onChange={() => toggleSelect(post.name)}
                      />
                    </label>

                    <div className="manage-item__content">
                      <Link to={`/p/${post.name}/`} className="manage-item__title">
                        {post.title}
                      </Link>
                      <div className="manage-item__meta">
                        <span className="manage-item__date">{formatTs(post.created_at)}</span>
                        {post.category && (
                          <span className="manage-item__category">{post.category.name}</span>
                        )}
                      </div>
                    </div>

                    <Link to={`/edit/${post.name}/`} className="btn btn-secondary manage-item__edit">
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
