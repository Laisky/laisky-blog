'use strict';

import { gql, request } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link, useLoaderData, useNavigate, useParams } from 'react-router-dom';

import { GraphqlAPI, formatTimeStr, getUserLanguage, KvKeyLanguage } from '../library/base.jsx';
import { Sidebar } from '../components/sidebar.jsx';
import { KvAddListener, KvOp } from '../library/libs.js';


export const loader = async ({ params }) => {
    let gqBody;
    if (params.category === 'all') {
        gqBody = gql`
            query {
                BlogPosts(
                    language: ${await getUserLanguage()}
                    page: {
                        page: 0
                        size: 200
                    }
                ) {
                    name
                    created_at
                    title
                }
            }
        `;
    } else {
        gqBody = gql`
            query {
                BlogPosts(
                    category_url: "${params.category}"
                    language: ${await getUserLanguage()}
                    page: {
                        page: 0
                        size: 200
                    }
                ) {
                    name
                    created_at
                    title
                }
            }
        `;
    }

    const resp = await request(GraphqlAPI, gqBody);
    return {
        postsData: resp.BlogPosts,
    };
}

export const Categories = () => {
    const [content, setContent] = useState(null);
    const params = useParams();

    useEffect(() => {
        updateContent();
        watchLanguageChange();
    }, [params.category]);

    const updateContent = async () => {
        const { postsData } = await loader({ params });
        const content = await Promise.all(postsData.map(async (post) => {
            return (
                <div className="container-fluid post" id={post.name} key={post.name}>
                    <span>{formatTimeStr(post.created_at)}</span>
                    <Link to={`/p/${post.name}/`}>{post.title}</Link>
                </div>
            );
        }));

        setContent(content);
    };

    const watchLanguageChange = () => {
        KvAddListener(KvKeyLanguage, async (key, op, oldVal, newVal) => {
            if (op !== KvOp.SET || key != KvKeyLanguage || oldVal === newVal) {
                return;
            }

            updateContent();
        }, "page_categories")
    };

    return (
        <div id="categories" className='row align-items-start'>
            {/* blog posts */}
            <div className='col-md-9 posts'>
                {content}
            </div>

            {/* posts sidebar */}
            <div className='col-md-3 sidebar'>
                <Sidebar />
            </div>
        </div>
    )
}
