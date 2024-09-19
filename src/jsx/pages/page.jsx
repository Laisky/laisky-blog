'use strict';

import React from 'react';
import { Link, useParams, useLoaderData } from 'react-router-dom';
import { gql, request } from 'graphql-request'

import { GraphqlAPI, formatTs, getCurrentUsername } from '../library/base.jsx';


export const loader = async ({ params }) => {
    const gqBody = gql`
        query {
            BlogPosts(
                language: en_US
                length: 200
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
    return resp.BlogPosts;
}

export const Page = () => {
    const { nPage } = useParams();
    const posts = useLoaderData();

    const getPostTails = (post) => {
        let articleEditable;
        if (getCurrentUsername()) {
            articleEditable = <Link to={`/amend/${post.name}/`}>编辑</Link>;
        }

        return articleEditable
    };

    return (
        <div className='container-fluid posts'>
            {posts.map((post) => (
                <div className="container-fluid post" id={post.name} key={post.name}>
                    <h2 className="post-title">
                        <Link to={`/p/${post.name}/`}>{post.title}</Link>
                    </h2>
                    <div className="post-meta">
                        <span>published: </span>
                        <span>{formatTs(post.created_at)}</span>
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
    )
}
