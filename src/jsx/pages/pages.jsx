'use strict';

import { gql, request } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link, useLoaderData, useParams } from 'react-router-dom';

import { Sidebar } from '../components/sidebar.jsx';
import { GraphqlAPI, formatTimeStr, getCurrentUsername, getUserLanguage } from '../library/base.jsx';


export const loader = async ({ params }) => {
    let postsData, nPosts;
    const f1 = (async() => {
        const gqBody = gql`
            query {
                BlogPosts(
                    language: ${await getUserLanguage()}
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
    const [ postsContent, setPostsContent ] = useState(null);

    useEffect(() => {
        const generatePostsContent = async () => {
            const content = await Promise.all(postsData.map(async (post) => {
                const postTail = await getPostTails(post);
                return (
                    <div className="container-fluid post" id={post.name} key={post.name}>
                        <h2 className="post-title">
                            <Link to={`/p/${post.name}/`}>{post.title}</Link>
                        </h2>
                        <div className="post-meta">
                            <span>published: </span>
                            <span>{formatTimeStr(post.created_at)}</span>
                        </div>
                        <div className="post-content">
                            {post.markdown}
                        </div>
                        <div className="post-tail">
                            {postTail}
                        </div>
                    </div>
                );
            }));
            setPostsContent(content);
        };

        generatePostsContent();
    }, [postsData]);


    const getPostTails = async (post) => {
        let articleEditable;
        if (await getCurrentUsername()) {
            articleEditable = <Link to={`/amend/${post.name}/`}>编辑</Link>;
        }

        return articleEditable
    };

    return (
        <div id="pages" className='row align-items-start'>
            {/* blog posts */}
            <div className='col-md-9 posts'>
                {postsContent}
            </div>

            {/* posts sidebar */}
            <div className='col-md-3 sidebar'>
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
        </div>
    )
}
