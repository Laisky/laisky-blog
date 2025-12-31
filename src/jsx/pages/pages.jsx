'use strict';

import jsutils from '@laisky/js-utils';
import { gql } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link, useLoaderData, useNavigate, useParams } from 'react-router-dom';

import { Sidebar } from '../components/sidebar.jsx';
import { Tooltip } from '../components/Tooltip.jsx';
import {
    KvKeyLanguage,
    KvKeyPrefixCache,
    formatTs,
    getCurrentUsername,
    getUserLanguage,
    graphqlQuery,
    isForce,
} from '../library/base.jsx';
import { loader as postLoader } from './post.jsx';

/**
 * loader loads page data including posts and total post count.
 *
 * @param {Object} params - Route params containing nPage
 * @returns {Promise<Object>} Object containing postsData and nPosts
 */
export const loader = async ({ params }) => {
    const [postsData, nPosts] = await Promise.all([loadPage(params.nPage), loadPostInfo()]);

    // preload surrounding pages
    const nPage = parseInt(params.nPage, 10);
    const preloadFrom = Math.max(0, nPage - 3);
    const preloadTo = Math.min(nPosts, nPage + 3);
    for (let i = preloadFrom; i < preloadTo; i++) {
        loadPage(i);
    }

    return { postsData, nPosts };
};

/**
 * Page component displays a paginated list of blog posts.
 *
 * @returns {React.ReactElement} The page component
 */
export const Page = () => {
    const [content, setContent] = useState(
        <>
            <div className="col-12 col-xl-8 posts posts-container placeholder-glow">
                <div className="page-heading">
                    <span className="placeholder col-6"></span>
                    <span className="placeholder col-4"></span>
                </div>
                <span className="placeholder col-10"></span>
                <span className="placeholder col-8"></span>
                <span className="placeholder col-7"></span>
                <span className="placeholder col-9"></span>
            </div>
            <div className="col-12 col-xl-3 d-none d-xl-block">
                <div className="sidebar">
                    <Sidebar />
                </div>
            </div>
        </>
    );
    const params = useParams();
    const navigate = useNavigate();
    const { nPosts } = useLoaderData();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const currentPage = parseInt(params.nPage, 10);
            const totalPage = Math.max(1, Math.ceil(nPosts / 10));

            if (e.key === 'ArrowLeft') {
                if (currentPage > 0) {
                    navigate(`/pages/${currentPage - 1}/`);
                }
            } else if (e.key === 'ArrowRight') {
                if (currentPage < totalPage - 1) {
                    navigate(`/pages/${currentPage + 1}/`);
                }
            } else if (e.key === 'ArrowDown') {
                const posts = document.querySelectorAll('.tape .post');
                for (const post of posts) {
                    const rect = post.getBoundingClientRect();
                    if (rect.top > 100) {
                        post.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                        });
                        e.preventDefault();
                        break;
                    }
                }
            } else if (e.key === 'ArrowUp') {
                const posts = Array.from(document.querySelectorAll('.tape .post')).reverse();
                for (const post of posts) {
                    const rect = post.getBoundingClientRect();
                    if (rect.top < -100) {
                        post.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                        });
                        e.preventDefault();
                        break;
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [params.nPage, nPosts, navigate]);

    useEffect(() => {
        (async () => {
            await generatePostsContent();
            watchLanguageChange();

            // update page title
            const currentPage = parseInt(params.nPage, 10) + 1;
            document.title = `Page ${currentPage}`;
        })();
    }, [params.nPage]);

    useEffect(() => {
        /**
         * handleScroll implements a smooth paper-ribbon effect for articles.
         *
         * Design philosophy:
         * - Uses native window scrolling for full browser compatibility
         * - First article always starts fully visible (no blur on page load)
         * - Gentle transitions: articles smoothly fade/reveal at edges
         * - Reading-friendly: large central zone stays fully visible
         */
        const handleScroll = () => {
            const posts = document.querySelectorAll('.tape .post');
            if (posts.length === 0) return;

            const viewportHeight = window.innerHeight;
            const navbarHeight = 52;

            // Define zones: a generous central area for reading
            // Top zone: only apply fade when article is scrolling OUT of view (above navbar)
            // Bottom zone: from 100px above bottom to bottom
            const bottomZoneStart = viewportHeight - 100; // Reduced from 150

            // Transition distances for smooth gradual effect
            const bottomTransitionRange = 80; // Reduced for tighter transition

            posts.forEach((post) => {
                const rect = post.getBoundingClientRect();
                const postTop = rect.top;

                // Calculate how much of the post is visible/faded
                let fadeProgress = 0; // 0 = fully visible, 1 = fully faded
                let isTop = false;

                // Only apply top fade when article is actually scrolling past the navbar
                if (rect.bottom <= navbarHeight) {
                    // Completely scrolled past - fully hidden
                    fadeProgress = 1;
                    isTop = true;
                } else if (postTop < navbarHeight && rect.bottom > navbarHeight) {
                    // Article is partially behind navbar - gradual fade based on how much is hidden
                    const visibleHeight = rect.bottom - navbarHeight;
                    const hiddenRatio = 1 - visibleHeight / rect.height;
                    fadeProgress = Math.min(1, Math.max(0, hiddenRatio * 1.5));
                    isTop = true;
                } else if (postTop > bottomZoneStart) {
                    // Article is entering from bottom - gradual fade
                    const distanceFromSafeZone = postTop - bottomZoneStart;
                    fadeProgress = Math.min(
                        1,
                        Math.max(0, distanceFromSafeZone / bottomTransitionRange)
                    );
                    isTop = false;
                }
                // Articles fully visible in the central zone: fadeProgress = 0

                // Smooth visual effects that don't create gaps
                // Use easeOutCubic for smoother transition
                const easedProgress = 1 - Math.pow(1 - fadeProgress, 3);

                // Opacity: gentle fade (never below 0.2 for continuity)
                const opacity = 1 - easedProgress * 0.8;

                // Subtle vertical movement (no scaling to avoid gaps)
                const translateY = easedProgress * 15 * (isTop ? -1 : 1);

                // Gentle rotation for paper-fold feel
                const rotateX = easedProgress * 10 * (isTop ? 1 : -1);

                // Blur for depth effect - reduced and only for scrolled-out content
                const blur = easedProgress * 1.5;

                post.style.setProperty('--fold-opacity', opacity);
                post.style.setProperty('--fold-translate', `${translateY}px`);
                post.style.setProperty('--fold-rotate', `${rotateX}deg`);
                post.style.setProperty('--fold-blur', `${blur}px`);
                post.style.setProperty('--fold-scale', 1); // No scaling to prevent gaps
            });
        };

        let ticking = false;
        const onScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        };

        // Listen to native window scroll events
        window.addEventListener('scroll', onScroll);
        window.addEventListener('resize', onScroll);

        // Use MutationObserver to detect when posts are actually added to the DOM
        const observer = new MutationObserver(() => {
            handleScroll();
        });

        const tapeElement = document.querySelector('.tape');
        if (tapeElement) {
            observer.observe(tapeElement, { childList: true, subtree: true });
        }

        // Initial call - ensure first article is clear
        handleScroll();

        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            observer.disconnect();
        };
    }, [content]);

    /**
     * generatePostsContent generates the HTML content for the posts on the current page.
     */
    const generatePostsContent = async () => {
        const currentPage = parseInt(params.nPage, 10);
        const { postsData, nPosts } = await loader({ params });
        const totalPage = Math.max(1, Math.ceil(nPosts / 10));
        const isFirstPage = currentPage <= 0;
        const isLastPage = currentPage >= totalPage - 1;
        const humanPage = currentPage + 1;

        const postsContent = [];
        for (const post of postsData) {
            // preload post to cache
            postLoader({ params: { name: post.name } });

            const postTail = await getPostTails(post);
            const postElement = (
                <div className="post" id={post.name} key={post.name}>
                    <h2 className="post-title">
                        <Link to={`/p/${post.name}/`}>{post.title}</Link>
                    </h2>
                    <div className="post-meta">
                        <span>published: </span>
                        <Tooltip content={post.created_at} placement="top">
                            <span className="tooltip-trigger">{formatTs(post.created_at)}</span>
                        </Tooltip>
                    </div>
                    <div className="post-content">{post.markdown}</div>
                    <div className="post-tail">{postTail}</div>
                </div>
            );

            postsContent.push(postElement);
        }

        const cnt = (
            <>
                {/* blog posts */}
                <div className="col-12 col-xl-8 posts posts-container">
                    <header className="page-heading">
                        <h1>Articles</h1>
                        <p>{`Page ${humanPage} of ${totalPage}`}</p>
                    </header>
                    <div className="tape">
                        {postsContent}
                        {/* pagination as part of the tape */}
                        <div className="post pagination-segment">
                            <nav className="footer">
                                <ul className="pagination justify-content-center">
                                    <li className={`page-item ${isFirstPage ? 'disabled' : ''}`}>
                                        <Link
                                            className="page-link"
                                            to={`/pages/${isFirstPage ? currentPage : currentPage - 1}/`}
                                            aria-label="Previous"
                                        >
                                            <span aria-hidden="true">&laquo;</span>
                                        </Link>
                                    </li>

                                    {Array.from({ length: totalPage }, (_, i) => {
                                        const page = i;
                                        const startPage = Math.max(0, currentPage - 3);
                                        const endPage = Math.min(totalPage - 1, currentPage + 3);

                                        if (page >= startPage && page <= endPage) {
                                            return (
                                                <li
                                                    key={page}
                                                    className={`page-item ${currentPage === page ? 'active' : ''}`}
                                                >
                                                    <Link
                                                        className="page-link"
                                                        to={`/pages/${page}/`}
                                                    >
                                                        {page + 1}
                                                    </Link>
                                                </li>
                                            );
                                        }

                                        return null;
                                    })}

                                    <li className={`page-item ${isLastPage ? 'disabled' : ''}`}>
                                        <Link
                                            className="page-link"
                                            to={`/pages/${isLastPage ? currentPage : currentPage + 1}/`}
                                            aria-label="Next"
                                        >
                                            <span aria-hidden="true">&raquo;</span>
                                        </Link>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                    </div>
                </div>

                {/* posts sidebar */}
                <div className="col-12 col-xl-3 d-none d-xl-block">
                    <div className="sidebar">
                        <Sidebar />
                    </div>
                </div>
            </>
        );

        setContent(cnt);
    };

    /**
     * watchLanguageChange watches for language changes and regenerates content.
     */
    const watchLanguageChange = async () => {
        await jsutils.KvAddListener(
            KvKeyLanguage,
            async (key, op, oldVal, newVal) => {
                if (op !== jsutils.KvOp.SET || key != KvKeyLanguage || oldVal === newVal) {
                    return;
                }

                await generatePostsContent();
            },
            'page_pages'
        );
    };

    /**
     * getPostTails gets the edit link for posts if user is logged in.
     */
    const getPostTails = async (post) => {
        let articleEditable;
        if (await getCurrentUsername()) {
            articleEditable = <Link to={`/edit/${post.name}/`}>Edit</Link>;
        }

        return articleEditable;
    };

    return (
        <div className="scrollable-content">
            <div id="pages" className="row align-items-start">
                {content}
            </div>
        </div>
    );
};

/**
 * loadPage loads posts for a specific page number.
 *
 * @param {number} nPage - The page number to load
 * @returns {Promise<Array>} Array of post objects
 */
const loadPage = async (nPage) => {
    console.debug(`loadPage: ${nPage}`);

    const cacheKey =
        KvKeyPrefixCache + (await jsutils.SHA256(`loadPage:${await getUserLanguage()}:${nPage}`));
    if (!isForce()) {
        const cacheData = await jsutils.GetCache(cacheKey);
        if (cacheData) {
            return cacheData;
        }
    }

    const gqBody = gql`
        query {
            BlogPosts(
                language: ${await getUserLanguage()}
                length: 600
                page: {
                    page: ${nPage}
                    size: 10
                }
            ) {
                name
                created_at
                modified_at
                type
                title
                menu
                markdown
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
    const result = resp.BlogPosts;

    // update cache
    await jsutils.SetCache(cacheKey, result);

    return result;
};

/**
 * loadPostInfo loads the total post count.
 *
 * @returns {Promise<number>} Total number of posts
 */
const loadPostInfo = async () => {
    const cacheKey = KvKeyPrefixCache + (await jsutils.SHA256(`loadPostInfo`));
    if (!isForce()) {
        const cacheData = await jsutils.GetCache(cacheKey);
        if (cacheData) {
            return cacheData;
        }
    }

    const gqBody = gql`
        query postinfo {
            BlogPostInfo {
                total
            }
        }
    `;

    const resp = await graphqlQuery(gqBody);
    const result = resp.BlogPostInfo.total;

    // update cache
    await jsutils.SetCache(cacheKey, result);

    return result;
};
