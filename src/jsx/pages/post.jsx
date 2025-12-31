'use strict';

import jsutils, { RandomString } from '@laisky/js-utils';
import { gql } from 'graphql-request';
import 'https://s3.laisky.com/static/prism/1.30.0/prism.js';
import { BookOpen, ChevronRight, FileText } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Comments } from '../components/comments.jsx';

import mermaid from 'mermaid';
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
} from '../library/base.jsx';

/**
 * loader loads post data by post name.
 *
 * @param {Object} params - Route params containing name
 * @returns {Promise<Object>} Post object
 */
export const loader = async ({ params }) => {
    const cacheKey =
        KvKeyPrefixCache + (await jsutils.SHA256(`post:${await getUserLanguage()}:${params.name}`));
    if (!isForce()) {
        const cacheData = await jsutils.GetCache(cacheKey);
        if (cacheData) {
            return cacheData;
        }
    }

    const gqBody = gql`
        query {
            BlogPosts(
                name: "${params.name}"
                language: ${await getUserLanguage()}
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

    const resp = await graphqlQuery(gqBody);
    const result = resp.BlogPosts[0];

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
export const historyLoader = async ({ params }) => {
    const cacheKey =
        KvKeyPrefixCache +
        (await jsutils.SHA256(`postHistory:${await getUserLanguage()}:${params.name}`));
    if (!isForce()) {
        const cacheData = await jsutils.GetCache(cacheKey);
        if (cacheData) {
            return cacheData;
        }
    }

    const gqBody = gql`
        query Blog {
            BlogPostHistory(
                file_id: "${params.name}"
                language: ${await getUserLanguage()}
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

    const resp = await graphqlQuery(gqBody);
    const result = resp.BlogPostHistory;

    // update cache
    await jsutils.SetCache(cacheKey, result);

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
    const [menuHtml, setMenuHtml] = useState(null);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [imageModalSrc, setImageModalSrc] = useState('');

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
        (async () => {
            let post;
            if (isHistory) {
                post = await historyLoader({ params });
            } else {
                post = await loader({ params });
            }

            const postTail = await loadPostTails(post);

            // change page title
            document.title = isHistory ? `[History] ${post.title}` : post.title;

            const hasMenu = typeof post.menu === 'string' && post.menu.trim() !== '';

            // Store menu HTML in state for rendering outside scrollable-content
            if (hasMenu) {
                setMenuHtml(post.menu);
            } else {
                setMenuHtml(null);
            }

            const content = (
                <>
                    <div className="col-12 col-xl-9">
                        <div className="posts">
                            <div className="post" id={post.name} key={post.name}>
                                <h2 className="post-title">
                                    <Link to={`/p/${post.name}/`}>
                                        {isHistory ? `[History] ${post.title}` : post.title}
                                    </Link>
                                </h2>
                                <div className="post-meta">
                                    <span>published: </span>
                                    <Tooltip content={post.created_at} placement="top">
                                        <span className="tooltip-trigger">
                                            {formatTs(post.created_at)}
                                        </span>
                                    </Tooltip>
                                </div>
                                <div
                                    className="post-content"
                                    dangerouslySetInnerHTML={{
                                        __html: post.content,
                                    }}
                                ></div>
                                {postTail}
                                <Comments postName={params.name} />
                            </div>
                        </div>
                    </div>
                </>
            );

            setContent(content);
        })();
    }, [params.name, language, isHistory]);

    // After render effects
    useEffect(() => {
        if (!content) {
            return;
        }

        let cleanupScrollSpy;
        let cleanupMenuScroll;
        let cleanupActiveState;

        (async () => {
            bindPostImageModal(setImageModalOpen, setImageModalSrc);
            renderCode();
            await renderMathjax();
            watchLanguageChange(setLanguage);

            // configure post menu behavior
            enhancePostMenu();
            improveMenuInteraction();

            cleanupScrollSpy = setupPostMenuScrollSpy();
            cleanupMenuScroll = setupPostMenuLinkScrolling();
            cleanupActiveState = setupPostMenuActiveState();

            parseAndReplacePostSeries();
            try {
                mermaid.run();
            } catch (e) {
                console.error(`failed to render mermaid: ${e}`);
            }
        })();

        return () => {
            if (cleanupScrollSpy) {
                cleanupScrollSpy();
            }
            if (cleanupMenuScroll) {
                cleanupMenuScroll();
            }
            if (cleanupActiveState) {
                cleanupActiveState();
            }
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
                    {content}
                </div>
            </div>
            {menuHtml && (
                <aside
                    id="post-menu"
                    className="post-menu d-none d-xl-block"
                    dangerouslySetInnerHTML={{ __html: menuHtml }}
                />
            )}
            <Modal
                isOpen={imageModalOpen}
                onClose={() => setImageModalOpen(false)}
                className="modal--image"
            >
                <img src={imageModalSrc} alt="" />
            </Modal>
        </>
    );
};

/**
 * enhancePostMenu enhances menu links with tooltips for truncated text.
 */
const enhancePostMenu = () => {
    try {
        setTimeout(() => {
            const postMenu = document.querySelector('.post-menu');
            if (!postMenu) {
                return;
            }

            const menuLinks = postMenu.querySelectorAll('a');

            if (menuLinks.length === 0) {
                postMenu.classList.add('is-hidden');
            } else {
                postMenu.classList.remove('is-hidden');
            }

            // Clean up existing tooltip wrappers
            menuLinks.forEach((link) => {
                link.removeAttribute('data-tooltip');
                link.removeAttribute('title');
            });

            menuLinks.forEach((link) => {
                const linkText = link.textContent.trim();

                // Create temp element to measure text width accurately
                const tempSpan = document.createElement('span');
                tempSpan.style.visibility = 'hidden';
                tempSpan.style.position = 'absolute';
                tempSpan.style.whiteSpace = 'nowrap';
                tempSpan.style.font = window.getComputedStyle(link).font;
                tempSpan.textContent = linkText;
                document.body.appendChild(tempSpan);

                const textWidth = tempSpan.offsetWidth;
                const availableWidth = link.offsetWidth - 20;
                document.body.removeChild(tempSpan);

                // Use native title for simple tooltip
                if (textWidth > availableWidth) {
                    link.setAttribute('title', linkText);
                }
            });
        }, 500);
    } catch (e) {
        console.error('Failed to enhance post menu:', e);
    }
};

/**
 * improveMenuInteraction adds persistent expansion behavior to menus.
 */
const improveMenuInteraction = () => {
    try {
        const postMenu = document.querySelector('.post-menu');
        if (!postMenu) return;

        const parentItems = postMenu.querySelectorAll('.nav-link');
        parentItems.forEach((item) => {
            const subMenu = item.nextElementSibling;
            if (!subMenu || !subMenu.classList.contains('nav-pills')) return;

            item.addEventListener('mouseenter', () => {
                postMenu.querySelectorAll('.nav-pills .nav-pills').forEach((menu) => {
                    if (!menu.querySelector('.nav-link.active')) {
                        menu.classList.remove('expanded');
                    }
                });

                subMenu.classList.add('expanded');
            });
        });

        postMenu.addEventListener('mouseleave', () => {
            postMenu.querySelectorAll('.nav-pills .nav-pills').forEach((menu) => {
                if (!menu.querySelector('.nav-link.active')) {
                    menu.classList.remove('expanded');
                }
            });
        });

        const subMenus = postMenu.querySelectorAll('.nav-pills .nav-pills');
        subMenus.forEach((menu) => {
            menu.addEventListener('mouseenter', () => {
                menu.classList.add('expanded');
            });
        });
    } catch (e) {
        console.error('Failed to improve menu interaction:', e);
    }
};

const POST_MENU_SCROLL_OFFSET = 120;

/**
 * getScrollContext determines the scroll context (element or document).
 */
const getScrollContext = () => {
    const explicitContainer = document.querySelector('.scrollable-content');
    if (explicitContainer) {
        const canScroll = explicitContainer.scrollHeight - explicitContainer.clientHeight > 4;
        if (canScroll) {
            return {
                type: 'element',
                element: explicitContainer,
            };
        }
    }

    const docEl = document.scrollingElement || document.documentElement || document.body;
    return {
        type: 'document',
        element: docEl,
    };
};

/**
 * setupPostMenuScrollSpy sets up scroll spy for the post menu using IntersectionObserver.
 */
const setupPostMenuScrollSpy = () => {
    try {
        const postMenu = document.querySelector('#post-menu');
        if (!postMenu || postMenu.classList.contains('is-hidden')) {
            return;
        }

        const headingSelector =
            '#post .post-content h1[id],#post .post-content h2[id],#post .post-content h3[id],#post .post-content h4[id],#post .post-content h5[id],#post .post-content h6[id]';
        const headings = Array.from(document.querySelectorAll(headingSelector));
        if (!headings.length) {
            return;
        }

        let lastActiveLink = null;

        const highlightLink = (link) => {
            if (lastActiveLink && lastActiveLink !== link) {
                lastActiveLink.classList.remove('active');
                lastActiveLink.classList.remove('is-current');
            }
            if (link) {
                link.classList.add('active');
                link.classList.add('is-current');
            }
            lastActiveLink = link || null;
        };

        const { type, element } = getScrollContext();
        const scrollElement = type === 'element' ? element : window;

        const updateActiveLink = () => {
            const rootRect =
                type === 'element' && element ? element.getBoundingClientRect() : { top: 0 };
            const targetLine = rootRect.top + POST_MENU_SCROLL_OFFSET + 1;

            let activeHeading = headings[0];
            for (const heading of headings) {
                const headingTop = heading.getBoundingClientRect().top;
                if (headingTop <= targetLine) {
                    activeHeading = heading;
                } else {
                    break;
                }
            }

            // Check if near bottom
            const isNearBottom = (() => {
                if (type === 'element' && element) {
                    return element.scrollTop + element.clientHeight >= element.scrollHeight - 2;
                }
                const doc = document.documentElement;
                const body = document.body;
                const scrollTop = window.scrollY || doc.scrollTop || 0;
                const viewportHeight = window.innerHeight || doc.clientHeight;
                const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight);
                return scrollTop + viewportHeight >= scrollHeight - 2;
            })();

            if (isNearBottom) {
                activeHeading = headings[headings.length - 1];
            }

            const link = activeHeading
                ? postMenu.querySelector(`.nav-link[href="#${escapeSelector(activeHeading.id)}"]`)
                : null;
            highlightLink(link);
        };

        let rafId = null;
        const scheduleUpdate = () => {
            if (rafId !== null) {
                return;
            }
            rafId = window.requestAnimationFrame(() => {
                rafId = null;
                updateActiveLink();
            });
        };

        scheduleUpdate();

        scrollElement.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', scheduleUpdate);

        return () => {
            scrollElement.removeEventListener('scroll', scheduleUpdate);
            window.removeEventListener('resize', scheduleUpdate);
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
            if (lastActiveLink) {
                lastActiveLink.classList.remove('active');
                lastActiveLink.classList.remove('is-current');
            }
        };
    } catch (e) {
        console.error('failed to setup post menu scrollspy:', e);
    }
};

/**
 * escapeSelector escapes special characters in CSS selectors.
 */
const escapeSelector = (value = '') => {
    try {
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(value);
        }
    } catch (err) {
        // ignore and fallback
    }

    return value.replace(/[\0-\x1F\x7F-\x9F!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\$&');
};

/**
 * setupPostMenuLinkScrolling sets up smooth scrolling for menu links.
 */
const setupPostMenuLinkScrolling = () => {
    try {
        const postMenu = document.querySelector('#post-menu');
        if (!postMenu || postMenu.classList.contains('is-hidden')) {
            return;
        }

        const { type, element } = getScrollContext();

        const handleClick = (event) => {
            const link = event.target.closest('a');
            if (!link) {
                return;
            }

            let url;
            try {
                url = new URL(link.href, window.location.href);
            } catch (err) {
                return;
            }

            if (url.pathname !== window.location.pathname) {
                return;
            }

            const hash = url.hash;
            if (!hash) {
                return;
            }

            const target = document.querySelector(hash);
            if (!target) {
                return;
            }

            event.preventDefault();

            const targetRect = target.getBoundingClientRect();
            const offset = POST_MENU_SCROLL_OFFSET - 16;

            if (type === 'element' && element) {
                const containerRect = element.getBoundingClientRect();
                const currentScrollTop = element.scrollTop;
                const desiredScrollTop =
                    currentScrollTop + (targetRect.top - containerRect.top) - offset;

                element.scrollTo({
                    top: Math.max(desiredScrollTop, 0),
                    behavior: 'smooth',
                });
            } else {
                const scrollTop =
                    window.scrollY ||
                    document.documentElement.scrollTop ||
                    document.body.scrollTop ||
                    0;
                const desiredScrollTop = scrollTop + targetRect.top - offset;

                window.scrollTo({
                    top: Math.max(desiredScrollTop, 0),
                    behavior: 'smooth',
                });
            }

            if (window?.history?.replaceState) {
                window.history.replaceState(null, '', hash);
            }
        };

        postMenu.addEventListener('click', handleClick);

        return () => {
            postMenu.removeEventListener('click', handleClick);
        };
    } catch (e) {
        console.error('failed to bind post menu smooth scrolling:', e);
    }
};

/**
 * setupPostMenuActiveState maintains active state for post menu links.
 */
const setupPostMenuActiveState = () => {
    // This is now handled by setupPostMenuScrollSpy
    return () => {};
};

/**
 * renderCode highlights code blocks using Prism.
 */
const renderCode = () => {
    try {
        document.querySelectorAll('pre > code').forEach((ele) => {
            window.Prism && window.Prism.highlightAllUnder(ele.closest('pre'));
        });
    } catch (e) {
        console.error(`failed to render code: ${e}`);
    }
};

/**
 * renderMathjax renders mathematical expressions using MathJax.
 */
const renderMathjax = () => {
    try {
        if (!window.MathJax) {
            const script = document.createElement('script');
            script.src =
                'https://s3.laisky.com/static/mathjax/2.7.3/MathJax-2.7.3/MathJax.js?config=TeX-MML-AM_CHTML';
            script.async = true;
            script.onload = () => {
                window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
                window.MathJax.Hub.Queue(optimizeMathDisplay);
            };
            script.onerror = (e) => {
                console.error(`failed to load mathjax: ${e}`);
            };
            document.head.appendChild(script);
        } else {
            window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
            window.MathJax.Hub.Queue(optimizeMathDisplay);
        }
    } catch (e) {
        console.error(`failed to render mathjax: ${e}`);
    }
};

/**
 * optimizeMathDisplay optimizes the display of math elements.
 */
const optimizeMathDisplay = () => {
    try {
        const inlineMathElements = document.querySelectorAll(
            '.math.inline, .math-inline, span.mjx-chtml'
        );

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
                {history.time}
            </DropdownItem>
        ));

        const historyTrigger = (
            <button className="btn btn-default dropdown-toggle" type="button">
                History
                <span className="caret"></span>
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
const bindPostImageModal = (setImageModalOpen, setImageModalSrc) => {
    const postImgs = document.querySelectorAll('.post-content p img');
    postImgs.forEach((img) => {
        if (img.dataset.bindmodal) {
            return;
        }
        img.dataset.bindmodal = 'true';

        img.addEventListener('click', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();

            setImageModalSrc(img.src);
            setImageModalOpen(true);
        });
    });
};

/**
 * watchLanguageChange watches for language changes and updates state.
 */
const watchLanguageChange = async (setLanguage) => {
    await jsutils.KvAddListener(
        KvKeyLanguage,
        async (key, op, oldVal, newVal) => {
            if (op !== jsutils.KvOp.SET || key != KvKeyLanguage || oldVal === newVal) {
                return;
            }

            setLanguage(newVal);
        },
        'page_post'
    );
};

/**
 * parseAndReplacePostSeries parses and replaces post series placeholders.
 */
const parseAndReplacePostSeries = async () => {
    const seriesElements = document.querySelectorAll('.post .post-content div.post_series');
    const tasks = Array.from(seriesElements).map(async (seEle) => {
        const postkey = seEle.getAttribute('key');
        const se = await loadSeries(postkey);
        if (!se) {
            return;
        }

        let html = parseSeriesHTML(se);
        if (se.children && se.children.length > 0) {
            for (let i = 0; i < se.children.length; i++) {
                html += await parseSeriesChildren(se.children[i].key);
            }
        }

        const iconHtml = renderToStaticMarkup(<BookOpen size={18} />);
        html = `
            <div class="post-series">
                <div class="post-series-header">
                    ${iconHtml}
                    <span class="post-series-title">${se.remark} Serials</span>
                </div>
                <ul class="post-series-list">
                    ${html}
                </ul>
            </div>`;
        seEle.innerHTML = html;
    });

    await Promise.all(tasks);
};

/**
 * loadSeries loads series data by key.
 */
async function loadSeries(postkey) {
    const cacheKey = KvKeyPrefixCache + (await jsutils.SHA256(`postSeries:${postkey}`));
    if (!isForce()) {
        const cacheData = await jsutils.GetCache(cacheKey);
        if (cacheData) {
            return cacheData;
        }
    }

    const gqBody = gql`
        query {
            GetBlogPostSeries(
                key: "${postkey}"
            ) {
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
    `;

    const resp = await graphqlQuery(gqBody);

    if (resp.GetBlogPostSeries.length < 1) {
        return null;
    }

    const result = resp.GetBlogPostSeries[0];

    // update cache
    await jsutils.SetCache(cacheKey, result);

    return result;
}

/**
 * parseSeriesHTML generates HTML for series posts.
 */
function parseSeriesHTML(se) {
    let html = '';
    const iconHtml = renderToStaticMarkup(<FileText size={14} />);
    if (se.posts && se.posts.length > 0) {
        for (let i = 0; i < se.posts.length; i++) {
            let p = se.posts[i];
            html += `
                <li class="post-series-entry">
                    <a class="post-series-link" href="https://blog.laisky.com/p/${p.name}/">
                        ${iconHtml}
                        <span>${p.title}</span>
                    </a>
                </li>`;
        }
    }

    return html;
}

/**
 * parseSeriesChildren generates HTML for nested series.
 */
async function parseSeriesChildren(seriesKey) {
    let se = await loadSeries(seriesKey);
    let html = parseSeriesHTML(se);
    if (se.children && se.children.length != 0) {
        for (let i = 0; i < se.children.length; i++) {
            html += await parseSeriesChildren(se.children[i].key);
        }
    }

    const iconHtml = renderToStaticMarkup(<ChevronRight size={16} className="chevron" />);

    // Use details/summary for native collapse without Bootstrap
    html = `
            <li class="post-series-entry post-series-entry--nested">
                <details class="series-details">
                    <summary class="series-toggle">
                        ${iconHtml}
                        <span>${se.remark} Serials</span>
                    </summary>
                    <div class="series-content">
                        <ul class="post-series-list">
                            ${html}
                        </ul>
                    </div>
                </details>
            </li>
        `;

    return html;
}
