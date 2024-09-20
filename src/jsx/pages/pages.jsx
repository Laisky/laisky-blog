'use strict';

import React from 'react';
import { Link, useParams, useLoaderData } from 'react-router-dom';
import { gql, request } from 'graphql-request'

import { GraphqlAPI, formatTimeStr, getCurrentUsername } from '../library/base.jsx';
import { Sidebar } from '../components/sidebar.jsx';


export const loader = async ({ params }) => {
    let postsData, nPosts;
    const f1 = (async() => {
        const gqBody = gql`
            query {
                BlogPosts(
                    language: en_US
                    length: 600
                    page: {
                        page: ${params.nPage}
                        size: 10
                    }
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

        const resp = await request(GraphqlAPI, gqBody);
        postsData = resp.BlogPosts;
    })();

    const f2 = (async() => {
        const gqBody = gql`
            query postinfo {
                BlogPostInfo {
                    total
                }
            }
        `;

        const resp = await request(GraphqlAPI, gqBody);
        nPosts = resp.BlogPostInfo.total;
    })();

    await Promise.all([f1, f2]);
    return { postsData, nPosts };
}

export const Page = () => {
    const { nPage } = useParams();
    const currentPage = parseInt(nPage, 10);
    const { postsData, nPosts } = useLoaderData();
    const totalPage = Math.ceil(nPosts / 10);

    const getPostTails = (post) => {
        let articleEditable;
        if (getCurrentUsername()) {
            articleEditable = <Link to={`/amend/${post.name}/`}>编辑</Link>;
        }

        return articleEditable
    };

    return (
        <div className='row align-items-start'>
            {/* blog posts */}
            <div className='col-md-9 posts'>
                {postsData.map((post) => (
                    <div className="container-fluid post" id={post.name} key={post.name}>
                        <h2 className="post-title">
                            <Link to={`/p/${post.name}/`}>{post.title}</Link>
                        </h2>
                        <div className="post-meta">
                            <span>published: </span>
                            <span>{formatTimeStr(post.created_at)}</span>
                        </div>
                        <div className="post-content">
                            {post.content}
                        </div>
                        <div className="post-tail">
                            {getPostTails(post)}
                        </div>
                    </div>
                ))}
            </div>

            {/* posts sidebar */}
            <div className='col-md-3 sidebar'>
                <Sidebar />
            </div>

            {/* pagination as footer */}
            <nav className="row footer">
                <ul className="pagination col justify-content-center">
                    <li className={`page-item ${currentPage <= 1 ? 'disabled' : ''}`}>
                        <Link className="page-link" to={`/pages/${currentPage - 1}`} aria-label="Previous">
                            <span aria-hidden="true">&laquo;</span>
                        </Link>
                    </li>

                    {Array.from({ length: totalPage }, (_, i) => {
                        const page = i + 1;
                        const startPage = Math.max(1, currentPage - 2);
                        const endPage = Math.min(totalPage, currentPage + 2);

                        if (page >= startPage && page <= endPage) {
                            return (
                                <li key={page} className={`page-item ${currentPage == page ? 'active' : ''}`}>
                                    <Link className="page-link" to={`/pages/${page}`}>
                                        {page}
                                    </Link>
                                </li>
                            );
                        }

                        return null;
                    })}

                    <li className={`page-item ${currentPage >= totalPage ? 'disabled' : ''}`}>
                        <Link className="page-link" to={`/pages/${parseInt(currentPage) + 1}`} aria-label="Next">
                            <span aria-hidden="true">&raquo;</span>
                        </Link>
                    </li>
                </ul>
            </nav>
        </div>
    )
}