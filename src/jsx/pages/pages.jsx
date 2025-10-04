'use strict';

import * as bootstrap from 'bootstrap';
import { gql } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import jsutils from '@laisky/js-utils';

import { Sidebar } from '../components/sidebar.jsx';
import {
    KvKeyLanguage,
    KvKeyPrefixCache,
    formatTs,
    getCurrentUsername, getUserLanguage,
    graphqlQuery,
    isForce
} from '../library/base.jsx';
import { loader as postLoader } from './post.jsx';


export const loader = async ({ params }) => {
    const [postsData, nPosts] = await Promise.all([
        loadPage(params.nPage),
        loadPostInfo(),
    ]);

    // preload surrounding pages
    const nPage = parseInt(params.nPage, 10);
    const preloadFrom = Math.max(0, nPage - 3);
    const preloadTo = Math.min(nPosts, nPage + 3);
    for (let i = preloadFrom; i < preloadTo; i++) {
        loadPage(i);
    }

    return { postsData, nPosts };
}

export const Page = () => {
    const [content, setContent] = useState(
        <div className='col-12 col-xl-8 posts placeholder-glow'>
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

    useEffect(() => {
        (async () => {
            await generatePostsContent();
            watchLanguageChange();

            // update page title
            const currentPage = parseInt(params.nPage, 10) + 1;
            document.title = `Page ${currentPage}`;

            // enable tooltips
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
            const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
        })();
    }, [params.nPage]);

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
                        <span >published: </span>
                        <span data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={`"${post.created_at}"`}>{formatTs(post.created_at)}
                        </span>
                    </div>
                    <div className="post-content">
                        {post.markdown}
                    </div>
                    <div className="post-tail">
                        {postTail}
                    </div>
                </div>
            );

            postsContent.push(postElement);
        }

        const cnt = <>
            {/* blog posts */}
            <div className='col-12 col-xl-8 posts'>
                <header className="page-heading">
                    <h1>Articles</h1>
                    <p>{`Page ${humanPage} of ${totalPage}`}</p>
                </header>
                {postsContent}
            </div>

            {/* posts sidebar */}
            <div className='col-12 col-xl-3 sidebar'>
                <Sidebar />
            </div>

            {/* pagination as footer */}
            <div className='col-12'>
                <nav className="footer">
                    <ul className="pagination justify-content-center">
                        <li className={`page-item ${isFirstPage ? 'disabled' : ''}`}>
                            <Link className="page-link" to={`/pages/${isFirstPage ? currentPage : currentPage - 1}/`} aria-label="Previous">
                                <span aria-hidden="true">&laquo;</span>
                            </Link>
                        </li>

                        {Array.from({ length: totalPage }, (_, i) => {
                            const page = i;
                            const startPage = Math.max(0, currentPage - 3);
                            const endPage = Math.min(totalPage - 1, currentPage + 3);

                            if (page >= startPage && page <= endPage) {
                                return (
                                    <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                        <Link className="page-link" to={`/pages/${page}/`}>
                                            {page + 1}
                                        </Link>
                                    </li>
                                );
                            }

                            return null;
                        })}

                        <li className={`page-item ${isLastPage ? 'disabled' : ''}`}>
                            <Link className="page-link" to={`/pages/${isLastPage ? currentPage : currentPage + 1}/`} aria-label="Next">
                                <span aria-hidden="true">&raquo;</span>
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>
        </>;

        setContent(cnt);
    };

    const watchLanguageChange = async () => {
        await jsutils.KvAddListener(KvKeyLanguage, async (key, op, oldVal, newVal) => {
            if (op !== jsutils.KvOp.SET || key != KvKeyLanguage || oldVal === newVal) {
                return;
            }

            await generatePostsContent();
        }, "page_pages")
    };

    const getPostTails = async (post) => {
        let articleEditable;
        if (await getCurrentUsername()) {
            articleEditable = <Link to={`/edit/${post.name}/`}>Edit</Link>;
        }

        return articleEditable
    };

    return (
        <div className="container-xl px-3 px-xl-0 scrollable-content">
            <div id="pages" className='row align-items-start'>
                {content}
            </div>
        </div>
    )
}

const loadPage = async (nPage) => {
    console.debug(`loadPage: ${nPage}`);

    const cacheKey = KvKeyPrefixCache + await jsutils.SHA256(`loadPage:${await getUserLanguage()}:${nPage}`);
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
    const cacheKey = KvKeyPrefixCache + await jsutils.SHA256(`loadPostInfo`);
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
}
