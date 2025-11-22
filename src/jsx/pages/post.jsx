'use strict';

import * as bootstrap from 'bootstrap';
import { gql } from 'graphql-request';
import 'https://s3.laisky.com/static/prism/1.30.0/prism.js';
import React, { useEffect, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, useParams } from 'react-router-dom';
import { AlignLeft } from 'lucide-react';
import { Comments } from '../components/comments.jsx';
import jsutils, { RandomString } from '@laisky/js-utils';

import {
    formatTs,
    getCurrentUsername, getUserLanguage,
    graphqlQuery,
    isForce,
    KvKeyLanguage,
    KvKeyPrefixCache
} from '../library/base.jsx';
import mermaid from 'mermaid';


export const loader = async ({ params }) => {
    const cacheKey = KvKeyPrefixCache + await jsutils.SHA256(`post:${await getUserLanguage()}:${params.name}`);
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
}

export const historyLoader = async ({ params }) => {
    const cacheKey = KvKeyPrefixCache + await jsutils.SHA256(`postHistory:${await getUserLanguage()}:${params.name}`);
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


export const Post = ({ isHistory }) => {
    isHistory = isHistory === 'true';
    const params = useParams();
    const [content, setContent] = useState(
        <div className='col-12 col-xl-9'>
            <div className='posts placeholder-glow'>
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
                    <div className='col-12 col-xl-9'>
                        <div className='posts'>
                            <div className="container-fluid post" id={post.name} key={post.name}>
                                <h2 className="post-title">
                                    <Link to={`/p/${post.name}/`}>{isHistory ? `[History] ${post.title}` : post.title}</Link>
                                </h2>
                                <div className="post-meta">
                                    <span >published: </span>
                                    <span data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={`"${post.created_at}"`}>{formatTs(post.created_at)}
                                    </span>
                                </div>
                                <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }}>
                                </div>
                                {postTail}
                                <Comments postName={params.name} />
                                {/* <DiscussionEmbed
                                shortname='laisky'
                                config={
                                    {
                                        url: `https://laisky.com/p/${params.name}/`,
                                        identifier: params.name,
                                        title: params.name,
                                        language: 'en_US' //e.g. for Traditional Chinese (Taiwan)
                                    }
                                }
                            /> */}
                            </div>
                        </div>
                    </div>
                </>
            );

            setContent(content);
        })();
    }, [params.name, language]);

    // after render
    useEffect(() => {
        if (!content) {
            return;
        }

        let cleanupScrollSpy;
        let cleanupMenuScroll;
        let cleanupActiveState;

        (async () => {
            bindPostImageModal();
            renderCode();
            await renderMathjax();
            watchLanguageChange()

            // enable tooltips
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
            Array.from(tooltipTriggerList).forEach(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

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

    // Also add a window resize listener to the component
    useEffect(() => {
        // Re-check for overflowing text when window resizes
        const handleResize = () => {
            enhancePostMenu();
        };

        window.addEventListener('resize', handleResize);

        // Clean up the event listener
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const watchLanguageChange = async () => {
        await jsutils.KvAddListener(KvKeyLanguage, async (key, op, oldVal, newVal) => {
            if (op !== jsutils.KvOp.SET || key != KvKeyLanguage || oldVal === newVal) {
                return;
            }

            setLanguage(newVal);
        }, "page_post")
    };

    return (
        <>
            <div className="container-xl px-3 px-xl-0 scrollable-content">
                <div id="post" className='row g-3 g-xl-4 align-items-start'>
                    {content}
                </div>
            </div>
            {menuHtml && (
                <aside id="post-menu" className="post-menu d-none d-xl-block" dangerouslySetInnerHTML={{ __html: menuHtml }} />
            )}
        </>
    )
}



/**
 * Enhance post menu with tooltip to display full text
 */
const enhancePostMenu = () => {
    try {
        // Delay the execution to ensure DOM is fully rendered
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

            // First dispose all existing tooltips to prevent duplicate instances
            menuLinks.forEach(link => {
                const tooltip = bootstrap.Tooltip.getInstance(link);
                if (tooltip) {
                    tooltip.dispose();
                }
            });

            menuLinks.forEach(link => {
                // Get dimensions
                const linkText = link.textContent.trim();

                // Create temp element to measure text width accurately
                const tempSpan = document.createElement('span');
                tempSpan.style.visibility = 'hidden';
                tempSpan.style.position = 'absolute';
                tempSpan.style.whiteSpace = 'nowrap';
                tempSpan.style.font = window.getComputedStyle(link).font;
                tempSpan.textContent = linkText;
                document.body.appendChild(tempSpan);

                // Compare text width with available width
                const textWidth = tempSpan.offsetWidth;
                const availableWidth = link.offsetWidth - 20; // Account for padding
                document.body.removeChild(tempSpan);

                // Only set up tooltip if text is actually truncated
                if (textWidth > availableWidth) {
                    // Use a data attribute to mark this as having a tooltip
                    link.setAttribute('data-bs-toggle', 'tooltip');
                    link.setAttribute('data-bs-placement', 'right');
                    link.setAttribute('data-bs-title', linkText);
                    link.setAttribute('data-bs-container', 'body');

                    // Initialize the tooltip with simpler options
                    new bootstrap.Tooltip(link, {
                        trigger: 'hover focus',
                        boundary: 'window',
                        offset: [0, 10]
                    });

                    // Ensure tooltip hides on mouseleave
                    link.addEventListener('mouseleave', () => {
                        const tooltip = bootstrap.Tooltip.getInstance(link);
                        if (tooltip) {
                            tooltip.hide();
                        }
                    });

                    // Hide tooltip on click
                    link.addEventListener('click', () => {
                        const tooltip = bootstrap.Tooltip.getInstance(link);
                        if (tooltip) {
                            tooltip.hide();
                        }
                    });
                } else {
                    // Remove tooltip attributes if not needed
                    link.removeAttribute('data-bs-toggle');
                    link.removeAttribute('data-bs-placement');
                    link.removeAttribute('data-bs-title');
                    link.removeAttribute('data-bs-container');
                }
            });
        }, 500);
    } catch (e) {
        console.error('Failed to enhance post menu:', e);
    }
};

/**
 * Improve menu interaction by adding persistent expansion
 */
const improveMenuInteraction = () => {
    try {
        const postMenu = document.querySelector('.post-menu');
        if (!postMenu) return;

        // Add mouseenter event to parent items
        const parentItems = postMenu.querySelectorAll('.nav-link');
        parentItems.forEach(item => {
            // Check if this item has children
            const subMenu = item.nextElementSibling;
            if (!subMenu || !subMenu.classList.contains('nav-pills')) return;

            // Add hover behavior that persists
            item.addEventListener('mouseenter', () => {
                // First remove expanded class from all submenus
                postMenu.querySelectorAll('.nav-pills .nav-pills').forEach(menu => {
                    if (!menu.querySelector('.nav-link.active')) {
                        menu.classList.remove('expanded');
                    }
                });

                // Expand this submenu
                subMenu.classList.add('expanded');
            });
        });

        // Add event to the menu container to handle mouse leaving the entire menu
        postMenu.addEventListener('mouseleave', () => {
            postMenu.querySelectorAll('.nav-pills .nav-pills').forEach(menu => {
                if (!menu.querySelector('.nav-link.active')) {
                    menu.classList.remove('expanded');
                }
            });
        });

        // Add mouseenter event to submenu to keep it expanded
        const subMenus = postMenu.querySelectorAll('.nav-pills .nav-pills');
        subMenus.forEach(menu => {
            menu.addEventListener('mouseenter', () => {
                menu.classList.add('expanded');
            });
        });

    } catch (e) {
        console.error('Failed to improve menu interaction:', e);
    }
};

const POST_MENU_SCROLL_OFFSET = 120;

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

const setupPostMenuScrollSpy = () => {
    try {
        const postMenu = document.querySelector('#post-menu');
        if (!postMenu || postMenu.classList.contains('is-hidden')) {
            return;
        }

        const { element } = getScrollContext();
        const scrollElement = element;

        if (!scrollElement) {
            return;
        }

        const existingInstance = bootstrap.ScrollSpy.getInstance(scrollElement);
        if (existingInstance) {
            existingInstance.dispose();
        }

        const scrollSpy = new bootstrap.ScrollSpy(scrollElement, {
            target: '#post-menu',
            smoothScroll: false,
            offset: POST_MENU_SCROLL_OFFSET,
        });

        let lastActiveLink = postMenu.querySelector('.nav-link.active');
        if (lastActiveLink) {
            lastActiveLink.classList.add('is-current');
        }

        const handleActivate = () => {
            const current = postMenu.querySelector('.nav-link.active');
            if (!current) {
                return;
            }

            if (lastActiveLink && lastActiveLink !== current) {
                lastActiveLink.classList.remove('is-current');
            }

            current.classList.add('is-current');
            lastActiveLink = current;
        };

        const handleClear = () => {
            if (lastActiveLink && !lastActiveLink.classList.contains('is-current')) {
                lastActiveLink.classList.add('is-current');
            }
        };

        const handleResize = () => {
            if (typeof scrollSpy.refresh === 'function') {
                scrollSpy.refresh();
            }
        };

        postMenu.addEventListener('activate.bs.scrollspy', handleActivate);
        postMenu.addEventListener('clear.bs.scrollspy', handleClear);
        window.addEventListener('resize', handleResize);

        // Allow dynamic content to settle before refreshing scrollspy
        setTimeout(() => {
            if (typeof scrollSpy.refresh === 'function') {
                scrollSpy.refresh();
            }
        }, 400);

        return () => {
            postMenu.removeEventListener('activate.bs.scrollspy', handleActivate);
            postMenu.removeEventListener('clear.bs.scrollspy', handleClear);
            window.removeEventListener('resize', handleResize);
            postMenu.querySelectorAll('.is-current').forEach(link => link.classList.remove('is-current'));
            if (typeof scrollSpy.dispose === 'function') {
                scrollSpy.dispose();
            }
        };
    } catch (e) {
        console.error('failed to setup post menu scrollspy:', e);
    }
};

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
                const desiredScrollTop = currentScrollTop + (targetRect.top - containerRect.top) - offset;

                element.scrollTo({
                    top: Math.max(desiredScrollTop, 0),
                    behavior: 'smooth',
                });
            } else {
                const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
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

const setupPostMenuActiveState = () => {
    try {
        const postMenu = document.querySelector('#post-menu');
        if (!postMenu || postMenu.classList.contains('is-hidden')) {
            return;
        }

        const headingSelector = '#post .post-content h1[id],#post .post-content h2[id],#post .post-content h3[id],#post .post-content h4[id],#post .post-content h5[id],#post .post-content h6[id]';
        const headings = Array.from(document.querySelectorAll(headingSelector));
        if (!headings.length) {
            return;
        }

        const { type, element } = getScrollContext();
        const scrollElement = type === 'element' ? element : window;
        if (!scrollElement) {
            return;
        }

        let lastHighlightedLink = null;
        let manualActiveLink = null;
        let rafId = null;

        const highlightLink = (link) => {
            if (lastHighlightedLink && lastHighlightedLink !== link) {
                lastHighlightedLink.classList.remove('is-current');
            }
            if (link) {
                link.classList.add('is-current');
            }
            lastHighlightedLink = link || null;
        };

        const isNearBottom = () => {
            if (type === 'element' && element) {
                return element.scrollTop + element.clientHeight >= element.scrollHeight - 2;
            }

            const doc = document.documentElement;
            const body = document.body;
            const scrollTop = window.scrollY || doc.scrollTop || 0;
            const viewportHeight = window.innerHeight || doc.clientHeight;
            const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight);
            return scrollTop + viewportHeight >= scrollHeight - 2;
        };

        const updateCurrentLink = () => {
            const activeFromSpy = postMenu.querySelector('.nav-link.active');
            if (activeFromSpy && activeFromSpy !== manualActiveLink) {
                if (manualActiveLink && manualActiveLink !== activeFromSpy) {
                    manualActiveLink.classList.remove('active');
                    manualActiveLink = null;
                }
                highlightLink(activeFromSpy);
                manualActiveLink = null;
                return;
            }

            const rootRect = type === 'element' && element ? element.getBoundingClientRect() : { top: 0 };
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

            if (isNearBottom()) {
                activeHeading = headings[headings.length - 1];
            }

            const link = activeHeading ? postMenu.querySelector(`.nav-link[href="#${escapeSelector(activeHeading.id)}"]`) : null;
            if (link) {
                if (manualActiveLink && manualActiveLink !== link) {
                    manualActiveLink.classList.remove('active');
                }
                link.classList.add('active');
                manualActiveLink = link;
            }
            highlightLink(link);
        };

        const scheduleUpdate = () => {
            if (rafId !== null) {
                return;
            }
            rafId = window.requestAnimationFrame(() => {
                rafId = null;
                updateCurrentLink();
            });
        };

        scheduleUpdate();

        const scrollTarget = type === 'element' && element ? element : window;
        scrollTarget.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', scheduleUpdate);

        return () => {
            if (scrollTarget) {
                scrollTarget.removeEventListener('scroll', scheduleUpdate);
            }
            window.removeEventListener('resize', scheduleUpdate);
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
            if (lastHighlightedLink) {
                lastHighlightedLink.classList.remove('is-current');
            }
            if (manualActiveLink) {
                manualActiveLink.classList.remove('active');
            }
        };
    } catch (e) {
        console.error('failed to maintain post menu active state:', e);
    }
};

const renderCode = () => {
    try {
        document.querySelectorAll('pre > code').forEach((ele) => {
            window.Prism && window.Prism.highlightAllUnder(ele.closest('pre'));
        });
    } catch (e) {
        console.error(`failed to render code: ${e}`);
    }
}

/**
 * Render MathJax for mathematical expressions
 */
const renderMathjax = () => {
    try {
        if (!window.MathJax) {
            const script = document.createElement('script');
            script.src = "https://s3.laisky.com/static/mathjax/2.7.3/MathJax-2.7.3/MathJax.js?config=TeX-MML-AM_CHTML";
            script.async = true;
            script.onload = () => {
                window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
                // Add callback to handle math elements after rendering
                window.MathJax.Hub.Queue(optimizeMathDisplay);
            };
            script.onerror = (e) => {
                console.error(`failed to load mathjax: ${e}`);
            };
            document.head.appendChild(script);
        } else {
            window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
            // Add callback to handle math elements after rendering
            window.MathJax.Hub.Queue(optimizeMathDisplay);
        }
    } catch (e) {
        console.error(`failed to render mathjax: ${e}`);
    }
};

const optimizeMathDisplay = () => {
    try {
        // Find all inline math elements
        const inlineMathElements = document.querySelectorAll('.math.inline, .math-inline, span.mjx-chtml');

        inlineMathElements.forEach(element => {
            // Ensure proper display property
            if (element.style.display !== 'inline-block') {
                element.style.display = 'inline-block';
            }

            // Check if the element needs horizontal scrolling
            const parentWidth = element.parentElement.offsetWidth;
            const contentWidth = element.scrollWidth;

            if (contentWidth > parentWidth) {
                // If content is wider than container, ensure it's set for scrolling
                element.style.maxWidth = '100%';
                element.style.overflowX = 'auto';
                element.style.overflowY = 'hidden';

                // Add a hint to users that this is scrollable (subtle visual cue)
                if (!element.classList.contains('scrollable-math')) {
                    element.classList.add('scrollable-math');

                    // For math in list items, ensure the li can handle it
                    if (element.closest('li')) {
                        element.closest('li').style.overflow = 'visible';
                    }
                }
            }
        });

        // Also handle display math blocks
        const displayMathElements = document.querySelectorAll('.MJXc-display');
        displayMathElements.forEach(element => {
            element.style.overflowX = 'auto';
            element.style.overflowY = 'hidden';
        });

    } catch (e) {
        console.error(`Failed to optimize math display: ${e}`);
    }
};

const loadPostTails = async (post) => {
    let articleEditable;
    if (await getCurrentUsername()) {
        articleEditable = <Link to={`/edit/${post.name}/`}>Edit</Link>;
    }


    // dropdown options for history
    let articleHistory = [];
    let maxHistory = 10;
    if (post['arweave_id']) {
        for (let i = 0; i < post['arweave_id'].length; i++) {
            if (i >= maxHistory) {
                break;
            }

            let history = post['arweave_id'][i];
            articleHistory.push(
                <li key={history.id}><Link to={`/p/history/${history.id}/`}>{history.time}</Link></li>
            );
        }

        articleHistory = (
            <div className="dropdown post-history">
                <button className="btn btn-default dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="true">
                    History
                    <span className="caret"></span>
                </button>
                <ul className="dropdown-menu">
                    {articleHistory}
                </ul>
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


let imgModal;

const bindPostImageModal = () => {
    if (!imgModal) {
        const modalEle = document.getElementById('showImageModal');
        imgModal = new bootstrap.Modal(modalEle);

        modalEle.addEventListener('click', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();

            imgModal.hide();
        });
    }

    // bind click event to post images
    const postImgs = document.querySelectorAll('.post-content p img');
    postImgs.forEach(img => {
        if (img.dataset.bindmodal) {
            return;
        }
        img.dataset.bindmodal = 'true';

        img.addEventListener('click', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();

            // Create a new img element
            const newImg = document.createElement('img');
            newImg.src = img.src;
            newImg.classList.add('img-fluid'); // Add any necessary classes

            // Clear the existing content in the modal body and append the new img element
            const modalBody = document.getElementById('showImageModal').querySelector('.modal-body');
            modalBody.innerHTML = ''; // Clear existing content
            modalBody.appendChild(newImg);

            // Show the modal
            imgModal.show();
        });
    });
};


/**
 * Parse and replace post series in the post content
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

        html = `
            <div class="card post-series-card">
                <div class="card-body post-series-card-body">
                    <h5 class="card-title post-series-title">${se.remark} Serials</h5>
                    <ul class="card-text post-series-list">
                        ${html}
                    </ul>
                </div>
            </div>`;
        seEle.innerHTML = html;
    });

    await Promise.all(tasks);
}


async function loadSeries(postkey) {
    const cacheKey = KvKeyPrefixCache + await jsutils.SHA256(`postSeries:${postkey}`);
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

function parseSeriesHTML(se) {
    let html = '';
    if (se.posts && se.posts.length > 0) {
        for (let i = 0; i < se.posts.length; i++) {
            let p = se.posts[i];
            html += `<li class="post-series-entry"><a class="post-series-link" href="https://blog.laisky.com/p/${p.name}/">${p.title}</a></li>`;
        }
    }

    return html;
}

async function parseSeriesChildren(seriesKey) {
    let se = await loadSeries(seriesKey);
    let sid = `series-${RandomString(16)}`;
    let html = parseSeriesHTML(se);
    if (se.children && se.children.length != 0) {
        for (let i = 0; i < se.children.length; i++) {
            html += await parseSeriesChildren(se.children[i].key);
        }
    }

    const iconHtml = renderToStaticMarkup(<AlignLeft size={16} />);

    html = `
            <li class="post-series-entry post-series-entry--nested">
                <a class="series-toggle" data-bs-toggle="collapse" href="#${sid}" role="button" aria-expanded="false" aria-controls="${sid}">
                    ${iconHtml}
                    <span>${se.remark} Serials：</span>
                </a>
                <div id="${sid}" class="collapse series-collapse">
                    <div class="card post-series-card post-series-card--nested">
                        <div class="card-body post-series-card-body">
                            <ul class="post-series-list">
                                ${html}
                            </ul>
                        </div>
                    </div>
                </div>
            </li>
        `

    return html;
}
