'use strict';

import * as bootstrap from 'bootstrap';
import { gql } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useLoaderData } from 'react-router-dom';
import jsutils from '@laisky/js-utils';

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

export const Page = () => {
    const [content, setContent] = useState(
        <div className="col-12 col-xl-8 posts placeholder-glow">
            <div className="page-heading">
                <span className="placeholder col-6"></span>
                <span className="placeholder col-4"></span>
            </div>
            <span className="placeholder col-10"></span>
            <span className="placeholder col-8"></span>
            <span className="placeholder col-7"></span>
            <span className="placeholder col-9"></span>
        </div>
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

            // enable tooltips
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            const tooltipList = [...tooltipTriggerList].map(
                (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
            );
        })();
    }, [params.nPage]);

    useEffect(() => {
        /**
         * handleScroll implements a paper-fold effect for articles.
         *
         * Behavior:
         * - Articles in the CENTER of viewport = fully expanded
         * - Articles ABOVE the viewport (scrolled past) = collapsed/folded UP
         * - Articles BELOW the viewport (not yet scrolled to) = collapsed/folded DOWN
         *
         * Scrolling DOWN: Lower articles unfold as they enter the viewport from below
         *                 Upper articles fold as they exit through the top
         * Scrolling UP:   Upper articles unfold as they re-enter from the top
         *                 Lower articles fold as they exit through the bottom
         */
        const handleScroll = () => {
            const posts = document.querySelectorAll('.tape .post');
            if (posts.length === 0) return;

            const viewportHeight = window.innerHeight;
            const navbarHeight = 52;

            // Define the "sweet spot" zone where articles are fully expanded
            // Limit the scroll-effect trigger to narrow bands at the top and bottom
            const sweetSpotTop = navbarHeight + 50; // Start folding 50px below navbar
            const sweetSpotBottom = viewportHeight - 100; // Start folding 100px above bottom

            // Fold animation range (how many pixels the full fold transition takes)
            const topFoldRange = 150; // Distance from sweetSpotTop to fully folded
            const bottomFoldRange = 200; // Distance from sweetSpotBottom to fully folded

            posts.forEach((post, index) => {
                const rect = post.getBoundingClientRect();

                let foldProgress = 0; // 0 = fully expanded, 1 = fully folded
                let foldDirection = 1; // 1 = fold up, -1 = fold down

                if (rect.bottom < navbarHeight) {
                    // Article is completely above the navbar - fully folded UP
                    foldProgress = 1;
                    foldDirection = 1;
                } else if (rect.top < sweetSpotTop) {
                    // Article is in the upper fold zone - transitioning fold UP
                    const distanceIntoFold = sweetSpotTop - rect.top;
                    foldProgress = Math.min(1, Math.max(0, distanceIntoFold / topFoldRange));
                    foldDirection = 1;
                } else if (rect.top > sweetSpotBottom) {
                    // Article is in the lower fold zone - transitioning fold DOWN
                    const distanceIntoFold = rect.top - sweetSpotBottom;
                    foldProgress = Math.min(1, Math.max(0, distanceIntoFold / bottomFoldRange));
                    foldDirection = -1;
                }
                // Articles between sweetSpotTop and sweetSpotBottom are fully expanded (foldProgress = 0)

                // Calculate visual properties with uniform folding
                const scaleY = 1 - foldProgress * 0.4; // Compress to 60% when fully folded
                const opacity = 1 - foldProgress * 0.7; // Fade to 30% when fully folded
                const translateY = foldProgress * 30 * foldDirection; // Movement
                const rotateX = foldProgress * 20 * foldDirection; // Uniform rotation

                post.style.setProperty('--fold-scale', scaleY);
                post.style.setProperty('--fold-opacity', opacity);
                post.style.setProperty('--fold-translate', `${translateY}px`);
                post.style.setProperty('--fold-rotate', `${rotateX}deg`);
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

        // Listen to both window scroll and the scrollable container
        window.addEventListener('scroll', onScroll, true); // Use capture to catch all scroll events
        window.addEventListener('resize', onScroll);

        // Also listen to the scrollable-content container specifically
        const scrollableContainer = document.querySelector('.scrollable-content');
        if (scrollableContainer) {
            scrollableContainer.addEventListener('scroll', onScroll);
        }

        // Use MutationObserver to detect when posts are actually added to the DOM
        const observer = new MutationObserver(() => {
            handleScroll();
        });

        const tapeElement = document.querySelector('.tape');
        if (tapeElement) {
            observer.observe(tapeElement, { childList: true, subtree: true });
        }

        // Initial call
        handleScroll();

        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
            if (scrollableContainer) {
                scrollableContainer.removeEventListener('scroll', onScroll);
            }
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
                <div className="container-fluid post" id={post.name} key={post.name}>
                    <h2 className="post-title">
                        <Link to={`/p/${post.name}/`}>{post.title}</Link>
                    </h2>
                    <div className="post-meta">
                        <span>published: </span>
                        <span
                            data-bs-toggle="tooltip"
                            data-bs-placement="top"
                            data-bs-title={`"${post.created_at}"`}
                        >
                            {formatTs(post.created_at)}
                        </span>
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
                <div className="col-12 col-xl-10 offset-xl-1 posts-container">
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
            </>
        );

        setContent(cnt);
    };

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

    const getPostTails = async (post) => {
        let articleEditable;
        if (await getCurrentUsername()) {
            articleEditable = <Link to={`/edit/${post.name}/`}>Edit</Link>;
        }

        return articleEditable;
    };

    return (
        <div className="container-xl px-3 px-xl-0 scrollable-content">
            <div id="pages" className="row align-items-start">
                {content}
            </div>
        </div>
    );
};

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
