'use strict';

import jsutils from '@laisky/js-utils';
import DOMPurify from 'dompurify';
import { gql } from 'graphql-request';
import parse from 'html-react-parser';
import { Archive, Info } from 'lucide-react';
import React, { useEffect, useState, useId, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Comments } from '../components/comments.jsx';
import { runAsyncWork } from '../library/asyncWork.js';
import { parseAndReplacePostSeries } from './postSeries.jsx';
import {
  enhancePostMenu,
  improveMenuInteraction,
  setupPostMenuScrollSpy,
  setupPostMenuLinkScrolling,
  setupPostMenuActiveState,
} from './postMenu.js';

import mermaid from 'mermaid';
import { CodeBlock } from '../components/CodeBlock.jsx';
import { Dropdown, DropdownItem } from '../components/Dropdown.jsx';
import { Modal } from '../components/Modal.jsx';
import { Tooltip } from '../components/Tooltip.jsx';
import {
  formatTs,
  getCurrentUsername,
  getUserLanguage,
  graphqlQuery,
  isForce,
  KvKeyLanguage,
  KvKeyPrefixCache,
  ts2UTC,
} from '../library/base.jsx';

/** validCurrentPost checks the required current-article render fields before accepting a network or cache result. */
const validCurrentPost = (post) =>
  post && typeof post.name === 'string' && typeof post.title === 'string' && typeof post.content === 'string';

/**
 * loader loads post data by post name.
 *
 * @param {Object} params - Route params containing name
 * @returns {Promise<Object>} Post object
 */
export const loader = async ({ params, language = null }) => {
  language = language || (await getUserLanguage());
  const cacheKey = KvKeyPrefixCache + (await jsutils.SHA256(`post:${language}:${params.name}`));
  if (!isForce()) {
    const cacheData = await jsutils.GetCache(cacheKey);
    if (validCurrentPost(cacheData)) {
      return cacheData;
    }
  }

  const gqBody = gql`
        query($name: String!) {
            BlogPosts(
                name: $name
                language: ${language}
            ) {
                name
                created_at
                modified_at
                type
                title
                menu
                content
                tags
                category {
                    name
                    url
                }
                arweave_id {
                    id
                    time
                }
            }
        }
    `;

  const resp = await graphqlQuery(gqBody, { name: params.name });
  if (!Array.isArray(resp?.BlogPosts)) throw new Error('Invalid article response');
  const result = resp.BlogPosts[0];
  if (!result) return null;
  if (!validCurrentPost(result)) throw new Error('Invalid article response');

  // update cache
  await jsutils.SetCache(cacheKey, result);

  return result;
};

/**
 * historyLoader loads historical post data by ID.
 *
 * @param {Object} params - Route params containing name (arweave ID)
 * @returns {Promise<Object>} Historical post object
 */
export const historyLoader = async ({ params, language = null }) => {
  language = language || (await getUserLanguage());
  // Historical cache entries predate publication authorization. Always recheck the server
  // before accepting an archive body, including previously cached or now-protected archives.
  const gqBody = gql`
        query Blog($fileId: String!) {
            BlogPostHistory(
                file_id: $fileId
                language: ${language}
            ) {
                name
                created_at
                modified_at
                type
                title
                menu
                content
                tags
                category {
                    name
                    url
                }
                arweave_id {
                    id
                    time
                }
            }
        }`;

  const resp = await graphqlQuery(gqBody, { fileId: params.name });
  const result = resp.BlogPostHistory;

  return result;
};

/**
 * Post component displays a single blog post with comments.
 *
 * @param {Object} props - Component props
 * @param {string} props.isHistory - Whether this is a historical version
 * @returns {React.ReactElement} The post component
 */
export const Post = ({ isHistory }) => {
  isHistory = isHistory === 'true';
  const params = useParams();
  const navigate = useNavigate();

  const [content, setContent] = useState(
    <div className="col-12 col-xl-9">
      <div className="posts placeholder-glow">
        <span className="placeholder col-7"></span>
        <span className="placeholder col-4"></span>
        <span className="placeholder col-4"></span>
        <span className="placeholder col-6"></span>
        <span className="placeholder col-8"></span>
      </div>
    </div>
  );
  const [language, setLanguage] = useState(null);
  const currentLanguage = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [enhancementFailed, setEnhancementFailed] = useState(false);
  const listenerName = useId();
  const [menuHtml, setMenuHtml] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalSrc, setImageModalSrc] = useState('');
  const [imageModalAlt, setImageModalAlt] = useState('');

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'ArrowDown') {
        const headingSelector =
          '#post .post-content h1[id],#post .post-content h2[id],#post .post-content h3[id],#post .post-content h4[id],#post .post-content h5[id],#post .post-content h6[id]';
        const headings = document.querySelectorAll(headingSelector);
        for (const heading of headings) {
          const rect = heading.getBoundingClientRect();
          if (rect.top > 100) {
            heading.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
            e.preventDefault();
            break;
          }
        }
      } else if (e.key === 'ArrowUp') {
        const headingSelector =
          '#post .post-content h1[id],#post .post-content h2[id],#post .post-content h3[id],#post .post-content h4[id],#post .post-content h5[id],#post .post-content h6[id]';
        const headings = Array.from(document.querySelectorAll(headingSelector)).reverse();
        for (const heading of headings) {
          const rect = heading.getBoundingClientRect();
          if (rect.top < -10) {
            heading.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
            e.preventDefault();
            break;
          }
        }
      } else if (e.key === 'ArrowLeft') {
        navigate(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Load post content
  useEffect(() => {
    let cancelled = false;
    const controller = new globalThis.AbortController();
    setEnhancementFailed(false);
    if (isHistory) {
      // Clear the previous historical body and menu before authorizing a new route.
      setMenuHtml(null);
      setContent(
        <div className="col-12 col-xl-9">
          <p role="status">Loading historical article…</p>
        </div>
      );
    }
    if (!isHistory) {
      setMenuHtml(null);
      setContent(
        <div className="col-12 col-xl-9">
          <p role="status">Loading article…</p>
        </div>
      );
    }
    (async () => {
      /** loadSelectedPost captures one language for this request and ignores a canceled language lookup. */
      const loadSelectedPost = async () => {
        const selectedLanguage = await getUserLanguage();
        if (cancelled) return;
        currentLanguage.current = selectedLanguage;
        return (isHistory ? historyLoader : loader)({ params, language: selectedLanguage });
      };
      let post;
      if (isHistory) {
        try {
          post = await runAsyncWork(loadSelectedPost, { signal: controller.signal });
        } catch {
          if (!cancelled) {
            setMenuHtml(null);
            setContent(
              <div className="col-12 col-xl-9">
                <p role="status">This historical article is unavailable.</p>
              </div>
            );
          }
          return;
        }
      } else {
        post = await runAsyncWork(loadSelectedPost, { signal: controller.signal });
      }
      if (cancelled) return;

      if (!post) {
        setMenuHtml(null);
        setContent(
          <div className="col-12 col-xl-9">
            <p role="status">{isHistory ? 'This historical article is unavailable.' : 'This article was not found.'}</p>
            <Link to="/pages/0/">Back to articles</Link>
          </div>
        );
        return;
      }
      if (typeof post.content !== 'string' || typeof post.title !== 'string' || typeof post.name !== 'string')
        throw new Error('Invalid article response');
      const postTail = await runAsyncWork(() => loadPostTails(post), { signal: controller.signal });
      if (cancelled) return;

      // change page title
      document.title = isHistory ? `[History] ${post.title}` : post.title;

      const hasMenu = typeof post.menu === 'string' && post.menu.trim() !== '';

      // Store menu HTML in state for rendering outside scrollable-content
      if (hasMenu) {
        setMenuHtml(post.menu);
      } else {
        setMenuHtml(null);
      }

      const parseOptions = {
        replace: (domNode) => {
          // Convert post_series "key" attribute to "data-series-key" so it survives
          // React rendering. React reserves "key" as an internal prop and strips it
          // from the DOM, which prevents parseAndReplacePostSeries() from reading it.
          if (domNode.name === 'div' && domNode.attribs?.class?.includes('post_series') && domNode.attribs?.key) {
            domNode.attribs['data-series-key'] = domNode.attribs.key;
            delete domNode.attribs.key;
          }

          // Add lazy loading to images
          if (domNode.name === 'img' && !domNode.attribs?.loading) {
            domNode.attribs = domNode.attribs || {};
            domNode.attribs.loading = 'lazy';
          }

          if (domNode.name === 'pre') {
            // Skip mermaid blocks
            if (domNode.attribs.class?.includes('mermaid')) {
              return;
            }

            const codeElement = domNode.children.find((child) => child.name === 'code');
            if (codeElement) {
              // Skip mermaid blocks inside code
              if (codeElement.attribs.class?.includes('mermaid')) {
                return;
              }

              const language = codeElement.attribs.class?.replace('language-', '') || 'text';
              const code = codeElement.children[0]?.data || '';
              return <CodeBlock language={language} value={code} />;
            }
          }
        },
      };

      const content = (
        <>
          <div className="col-12 col-xl-9">
            <div className="posts">
              <div className="post" id={post.name} key={post.name}>
                {isHistory && (
                  <div className="history-banner">
                    <Archive size={20} className="history-banner-icon" />
                    <div>
                      This is a historical version of the article. The latest version can be found at{' '}
                      <Link to={`/p/${post.name}/`}>{post.title}</Link>.
                    </div>
                  </div>
                )}
                <h1 className="post-title">
                  <Link to={`/p/${post.name}/`}>{isHistory ? `[History] ${post.title}` : post.title}</Link>
                </h1>
                <div className="post-meta">
                  <span>published: </span>
                  <Tooltip content={ts2UTC(post.created_at)} placement="top">
                    <span className="tooltip-trigger">{formatTs(post.created_at)}</span>
                  </Tooltip>
                </div>
                <div className="post-content">{parse(post.content, parseOptions)}</div>
                {postTail}
                {isHistory ? (
                  <div className="history-comment-prompt">
                    <Info size={24} className="history-comment-icon" />
                    <p>Comments are disabled for historical versions.</p>
                    <p>
                      Please visit the <Link to={`/p/${post.name}/`}>latest version</Link> to join the discussion.
                    </p>
                  </div>
                ) : (
                  <Comments postName={params.name} />
                )}
              </div>
            </div>
          </div>
        </>
      );

      setContent(content);
    })().catch(() => {
      if (cancelled) return;
      setMenuHtml(null);
      setContent(
        <div className="col-12 col-xl-9" role="alert">
          <p>{isHistory ? 'This historical article is unavailable.' : 'This article could not be loaded.'}</p>
          {!isHistory && (
            <button type="button" className="btn btn-outline-primary" onClick={() => setAttempt((value) => value + 1)}>
              Retry loading article
            </button>
          )}
          <p>
            <Link to="/pages/0/">Back to articles</Link>
          </p>
        </div>
      );
    });
    // Ignore a completed request after navigation, language change, or unmount.
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [params.name, language, isHistory, attempt]);

  useEffect(() => {
    const controller = new globalThis.AbortController();
    const signal = controller.signal;
    /** changeLanguage invalidates the view only when the effective request language actually changes. */
    const changeLanguage = (nextLanguage) => {
      if (nextLanguage === currentLanguage.current) return;
      currentLanguage.current = nextLanguage;
      setLanguage(nextLanguage);
    };
    watchLanguageChange(changeLanguage, listenerName, signal).catch(() => {
      if (!signal.aborted) setEnhancementFailed(true);
    });
    return () => {
      controller.abort();
      jsutils.KvRemoveListener?.(KvKeyLanguage, listenerName);
    };
  }, [listenerName]);

  // Article enhancements have independent owners and cannot commit after this content is replaced.
  useEffect(() => {
    const root = document.querySelector('#post');
    if (!root?.querySelector('.post-content')) return;
    const controller = new globalThis.AbortController();
    const signal = controller.signal;
    /** featureFailed exposes one static fallback while leaving the authored article readable. */
    const featureFailed = () => {
      if (!signal.aborted) setEnhancementFailed(true);
    };
    const cleanupImages = bindPostImageModal(setImageModalOpen, setImageModalSrc, setImageModalAlt);
    renderMathjax(signal).catch(featureFailed);
    parseAndReplacePostSeries({ root, signal }).catch(featureFailed);
    if (root.querySelector('.mermaid'))
      runAsyncWork(() => mermaid.run({ nodes: root.querySelectorAll('.mermaid') }), { signal }).catch(featureFailed);
    const cleanupMenu = enhancePostMenu();
    improveMenuInteraction();
    const cleanupScrollSpy = setupPostMenuScrollSpy();
    const cleanupMenuScroll = setupPostMenuLinkScrolling();
    const cleanupActiveState = setupPostMenuActiveState();
    return () => {
      controller.abort();
      cleanupImages?.();
      cleanupMenu?.();
      cleanupScrollSpy?.();
      cleanupMenuScroll?.();
      cleanupActiveState?.();
    };
  }, [content]);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      enhancePostMenu();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <>
      <div className="scrollable-content">
        <div id="post" className="row g-3 g-xl-4 align-items-start">
          {enhancementFailed && <p role="status">Some article features are unavailable. The article remains readable.</p>}
          {content}
        </div>
      </div>
      {menuHtml && (
        <aside id="post-menu" className="post-menu d-none d-xl-block" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(menuHtml) }} />
      )}
      <Modal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        size="fullscreen"
        className="modal--image"
        closeOnContentClick
      >
        <button type="button" className="image-modal__close" onClick={() => setImageModalOpen(false)} aria-label="Close image">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <img src={imageModalSrc} alt={imageModalAlt || 'Enlarged image'} />
      </Modal>
    </>
  );
};

/**
 * renderMathjax renders mathematical expressions using MathJax.
 */
const renderMathjax = async (signal) => {
  if (!window.MathJax?.Hub?.Queue) {
    await runAsyncWork(
      () => jsutils.LoadJsModules(['https://s3.laisky.com/static/mathjax/2.7.3/MathJax-2.7.3/MathJax.js?config=TeX-MML-AM_CHTML']),
      { signal }
    );
  }
  if (signal.aborted) return;
  if (!window.MathJax?.Hub?.Queue) throw new Error('Math rendering is unavailable');
  window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
  window.MathJax.Hub.Queue(() => {
    if (!signal.aborted) optimizeMathDisplay();
  });
};

/**
 * optimizeMathDisplay optimizes the display of math elements.
 */
const optimizeMathDisplay = () => {
  try {
    const inlineMathElements = document.querySelectorAll('.math.inline, .math-inline, span.mjx-chtml');

    inlineMathElements.forEach((element) => {
      if (element.style.display !== 'inline-block') {
        element.style.display = 'inline-block';
      }

      const parentWidth = element.parentElement.offsetWidth;
      const contentWidth = element.scrollWidth;

      if (contentWidth > parentWidth) {
        element.style.maxWidth = '100%';
        element.style.overflowX = 'auto';
        element.style.overflowY = 'hidden';

        if (!element.classList.contains('scrollable-math')) {
          element.classList.add('scrollable-math');

          if (element.closest('li')) {
            element.closest('li').style.overflow = 'visible';
          }
        }
      }
    });

    const displayMathElements = document.querySelectorAll('.MJXc-display');
    displayMathElements.forEach((element) => {
      element.style.overflowX = 'auto';
      element.style.overflowY = 'hidden';
    });
  } catch (e) {
    console.error(`Failed to optimize math display: ${e}`);
  }
};

/**
 * loadPostTails loads the post tail section with edit link and history dropdown.
 */
const loadPostTails = async (post) => {
  let articleEditable;
  if (await getCurrentUsername()) {
    articleEditable = <Link to={`/edit/${post.name}/`}>Edit</Link>;
  }

  // History dropdown
  let articleHistory = null;
  const maxHistory = 10;
  if (post['arweave_id'] && post['arweave_id'].length > 0) {
    const historyItems = post['arweave_id'].slice(0, maxHistory).map((history) => (
      <DropdownItem key={history.id} href={`/p/history/${history.id}/`}>
        <Tooltip content={ts2UTC(history.time)} placement="right">
          <span className="tooltip-trigger">{formatTs(history.time)}</span>
        </Tooltip>
      </DropdownItem>
    ));

    const historyTrigger = (
      <button className="btn btn-default dropdown-toggle" type="button">
        History
      </button>
    );

    articleHistory = (
      <div className="post-history">
        <Dropdown trigger={historyTrigger}>{historyItems}</Dropdown>
      </div>
    );
  }

  return (
    <div className="post-tail">
      {articleHistory}
      {articleEditable}
    </div>
  );
};

/**
 * bindPostImageModal binds click events to post images to open modal.
 */
const bindPostImageModal = (setImageModalOpen, setImageModalSrc, setImageModalAlt) => {
  const bindings = [];
  document.querySelectorAll('.post-content p img').forEach((img) => {
    /** showImage opens the current article's image without retaining a listener after replacement. */
    const showImage = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      setImageModalSrc(img.src);
      setImageModalAlt(img.alt || '');
      setImageModalOpen(true);
    };
    img.addEventListener('click', showImage);
    bindings.push(() => img.removeEventListener('click', showImage));
  });
  return () => {
    bindings.forEach((remove) => remove());
  };
};

/**
 * watchLanguageChange watches for language changes and updates state.
 */
const watchLanguageChange = async (setLanguage, listenerName, signal) => {
  await jsutils.KvAddListener(
    KvKeyLanguage,
    async (key, op, oldVal, newVal) => {
      if (signal.aborted || op !== jsutils.KvOp.SET || key !== KvKeyLanguage || oldVal === newVal) {
        return;
      }

      setLanguage(newVal);
    },
    listenerName
  );
  if (signal.aborted) jsutils.KvRemoveListener?.(KvKeyLanguage, listenerName);
};
