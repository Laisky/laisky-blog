'use strict';

import { gql, request } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link, useLoaderData } from 'react-router-dom';

import { GraphqlAPI, formatTimeStr, getUserLanguage } from '../library/base.jsx';
import { Sidebar } from '../components/sidebar.jsx';


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
    const [ content, setContent ] = useState(null);
    const { postsData } = useLoaderData();

    useEffect(() => {
        const generatecontent = async () => {
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

        generatecontent();
    }, [postsData]);

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
