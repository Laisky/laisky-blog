'use strict';

import { gql, request } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Sidebar } from '../components/sidebar.jsx';
import {
    DurationDay,
    formatTs,
    getGraphqlAPI,
    getUserLanguage,
    KvKeyLanguage,
    KvKeyPrefixCache
} from '../library/base.jsx';
import {
    GetCache,
    KvAddListener,
    KvOp,
    SetCache,
    SHA256
} from '../library/libs.js';


export const loader = async ({ params }) => {
    const cacheKey = KvKeyPrefixCache + await SHA256(`${await getUserLanguage()}:${params.category}`);
    const cacheData = await GetCache(cacheKey);
    if (cacheData) {
        return cacheData;
    }

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

    const resp = await request(getGraphqlAPI(), gqBody);
    const result = {
        postsData: resp.BlogPosts,
    };

    // update cache
    SetCache(cacheKey, result, DurationDay);

    return result;
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
                    <span>{formatTs(post.created_at)}</span>
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
        <div id="categories" className='row align-items-start scrollable-content'>
            {/* blog posts */}
            <div className='col-md-8 col-lg-9 posts'>
                {content}
            </div>

            {/* posts sidebar */}
            <div className='d-none d-md-block col-md-3 col-lg-2 sidebar'>
                <Sidebar />
            </div>
        </div>
    )
}
