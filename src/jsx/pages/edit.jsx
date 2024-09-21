'use strict';

import React from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { gql, request } from 'graphql-request';
import 'https://s3.laisky.com/static/prism/1.29.0/prism.js';

import { GraphqlAPI, getUserLanguage } from '../library/base.jsx';


export const loader = async ({ params }) => {
    console.log('loader', params);
    const gqBody = gql`
        query {
            BlogPosts(
                name: "${params.name}"
                language: ${await getUserLanguage()}
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
    return resp.BlogPosts[0];
}

export const PostEdit = () => {
    const post = useLoaderData();
    const navigate = useNavigate();

    const submitHandler = async () => {
        const language = document.getElementById("#postEdit")
            .querySelector('postLanguage').value;

        const variables = {
            post: {
                title: document.getElementById("#postEdit")
                    .querySelector('postTitle').value,
                name: document.getElementById("#postEdit")
                    .querySelector('postName').value,
                markdown: document.getElementById("#postEdit")
                    .querySelector('postMarkdown').value,
                type: document.getElementById("#postEdit")
                    .querySelector('postType').value,
            },
        };
        const gqBody = gql`
            mutation($post: NewBlogPost!) {
                BlogAmendPost(
                    post: $post,
                    language: ${language},
                ) {
                    name
                }
            }
        `;

        const resp = await request(GraphqlAPI, gqBody, variables);
        navigate(`/p/${resp.BlogAmendPost.name}/?force=1`);
    };

    return (
        <div id="postEdit" className='row align-items-start'>
            {/* blog posts */}
            <div className='col-md-9 posts'>
                <div className="container-fluid post" id={post.name} key={post.name}>
                    <div className="mb-3">
                        <label htmlFor="postTitle" className="form-label">Title</label>
                        <input
                            type="text"
                            className="form-control postTitle"
                            value={post.title}
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="postName" className="form-label">Name</label>
                        <input
                            type="text"
                            className="form-control postName"
                            value={post.name}
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="postMarkdown" className="form-label">Markdown</label>
                        <textarea
                            className="form-control postMarkdown"
                            value={post.markdown}
                            rows="10"
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="postLanguage" className="form-label">Language</label>
                        <select
                            className="form-select postLanguage"
                            value={post.language}
                        >
                            <option value="en_US">en_US</option>
                            <option value="zh_CN">zh_CN</option>
                        </select>
                    </div>
                    <div className="mb-3">
                        <label htmlFor="postType" className="form-label">Type</label>
                        <select
                            className="form-select postType"
                            defaultValue="markdown"
                        >
                            <option value="markdown">Markdown</option>
                            <option value="slide">Slide</option>
                        </select>
                    </div>
                    <button type="submit" className="btn btn-primary" onClick={submitHandler}>Submit</button>
                </div>
            </div>
        </div>
    )
}
