'use strict';

import * as bootstrap from 'bootstrap';
import { gql } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Sidebar } from '../components/sidebar.jsx';
import {
    KvKeyLanguage,
    KvKeyPrefixCache,
    formatTs,
    getCurrentUsername, getUserLanguage,
    graphqlQuery
} from '../library/base.jsx';
import {
    GetCache,
    KvAddListener,
    KvOp,
    SHA256,
    SetCache
} from '../library/libs.js';
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
    const [content, setContent] = useState('waiting to load...');
    const params = useParams();

    useEffect(() => {
        (async () => {
            await generatePostsContent();
            watchLanguageChange();

            // update page title
            document.title = `Page ${params.nPage}`;

            // enable tooltips
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
            const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
        })();
    }, [params.nPage]);

    const generatePostsContent = async () => {
        const currentPage = parseInt(params.nPage, 10);
        const { postsData, nPosts } = await loader({ params });
        const totalPage = Math.ceil(nPosts / 10);

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
            <div className='col-md-8 col-lg-9 posts'>
                {postsContent}
            </div>

            {/* posts sidebar */}
            <div className='d-none d-md-block col-md-3 col-lg-2 sidebar'>
                <Sidebar />
            </div>

            {/* pagination as footer */}
            <nav className="row footer">
                <ul className="pagination col justify-content-center">
                    <li className={`page-item ${currentPage <= 1 ? 'disabled' : ''}`}>
                        <Link className="page-link" to={`/pages/${currentPage - 1}/`} aria-label="Previous">
                            <span aria-hidden="true">&laquo;</span>
                        </Link>
                    </li>

                    {Array.from({ length: totalPage }, (_, i) => {
                        const page = i;
                        const startPage = Math.max(0, currentPage - 3);
                        const endPage = Math.min(totalPage, currentPage + 3);

                        if (page >= startPage && page <= endPage) {
                            return (
                                <li key={page} className={`page-item ${currentPage == page ? 'active' : ''}`}>
                                    <Link className="page-link" to={`/pages/${page}/`}>
                                        {page}
                                    </Link>
                                </li>
                            );
                        }

                        return null;
                    })}

                    <li className={`page-item ${currentPage >= totalPage ? 'disabled' : ''}`}>
                        <Link className="page-link" to={`/pages/${parseInt(currentPage) + 1}/`} aria-label="Next">
                            <span aria-hidden="true">&raquo;</span>
                        </Link>
                    </li>
                </ul>
            </nav>
        </>;

        setContent(cnt);
    };

    const watchLanguageChange = () => {
        KvAddListener(KvKeyLanguage, async (key, op, oldVal, newVal) => {
            if (op !== KvOp.SET || key != KvKeyLanguage || oldVal === newVal) {
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
        <div id="pages" className='row align-items-start scrollable-content'>
            {content}
        </div>
    )
}

const loadPage = async (nPage) => {
    console.debug(`loadPage: ${nPage}`);
    const cacheKey = KvKeyPrefixCache + await SHA256(`loadPage:${await getUserLanguage()}:${nPage}`);
    const cacheData = await GetCache(cacheKey);
    if (cacheData) {
        return cacheData;
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
    await SetCache(cacheKey, result);

    return result;
};

const loadPostInfo = async () => {
    const cacheKey = KvKeyPrefixCache + await SHA256(`loadPostInfo`);
    const cacheData = await GetCache(cacheKey);
    if (cacheData) {
        return cacheData;
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
    await SetCache(cacheKey, result);

    return result;
}
