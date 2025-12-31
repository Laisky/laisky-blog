'use strict';

import jsutils from '@laisky/js-utils';
import { gql } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Sidebar } from '../components/sidebar.jsx';
import { Tooltip } from '../components/Tooltip.jsx';
import {
    DurationDay,
    formatTs,
    getUserLanguage,
    graphqlQuery,
    isForce,
    KvKeyLanguage,
    KvKeyPrefixCache,
    ts2UTC,
} from '../library/base.jsx';

export const loader = async ({ params }) => {
    const cacheKey =
        KvKeyPrefixCache +
        (await jsutils.SHA256(`categories:${await getUserLanguage()}:${params.category}`));
    if (!isForce()) {
        const cacheData = await jsutils.GetCache(cacheKey);
        if (cacheData) {
            return cacheData;
        }
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

    const resp = await graphqlQuery(gqBody);
    const result = {
        postsData: resp.BlogPosts,
    };

    // update cache
    jsutils.SetCache(cacheKey, result, DurationDay);

    return result;
};

export const Categories = () => {
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const params = useParams();

    useEffect(() => {
        updateContent();
        watchLanguageChange();
    }, [params.category]);

    const updateContent = async () => {
        setIsLoading(true);
        const { postsData } = await loader({ params });
        setPosts(postsData);
        setIsLoading(false);
    };

    const watchLanguageChange = async () => {
        await jsutils.KvAddListener(
            KvKeyLanguage,
            async (key, op, oldVal, newVal) => {
                if (op !== jsutils.KvOp.SET || key != KvKeyLanguage || oldVal === newVal) {
                    return;
                }

                updateContent();
            },
            'page_categories'
        );
    };

    const categorySlug = params.category || 'all';
    const categoryName =
        categorySlug === 'all'
            ? 'All Posts'
            : categorySlug.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

    return (
        <div className="scrollable-content">
            <div id="categories" className="row g-3 g-xl-4 align-items-start">
                {/* category posts */}
                <div className="col-12 col-xl-8 posts">
                    <header className="page-heading">
                        <h1>{categoryName}</h1>
                        <p>
                            {isLoading
                                ? 'Loading posts…'
                                : `${posts.length} post${posts.length === 1 ? '' : 's'}`}
                        </p>
                    </header>

                    {isLoading && (
                        <div className="section-card placeholder-glow">
                            <span className="placeholder col-8"></span>
                            <span className="placeholder col-6"></span>
                            <span className="placeholder col-5"></span>
                        </div>
                    )}

                    {!isLoading &&
                        posts.map((post) => (
                            <div className="post" id={post.name} key={post.name}>
                                <Tooltip content={ts2UTC(post.created_at)} placement="top">
                                    <span className="tooltip-trigger">
                                        {formatTs(post.created_at)}
                                    </span>
                                </Tooltip>
                                <Link to={`/p/${post.name}/`}>{post.title}</Link>
                            </div>
                        ))}
                </div>

                {/* posts sidebar */}
                <div className="col-12 col-xl-3 d-none d-xl-block">
                    <div className="sidebar">
                        <Sidebar />
                    </div>
                </div>
            </div>
        </div>
    );
};
