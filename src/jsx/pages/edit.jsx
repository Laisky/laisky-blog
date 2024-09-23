'use strict';

import React from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { gql, request } from 'graphql-request';
import 'https://s3.laisky.com/static/prism/1.29.0/prism.js';

import { getGraphqlAPI, getUserLanguage } from '../library/base.jsx';


export const postEditLoader = async ({ params }) => {
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

    const resp = await request(getGraphqlAPI(), gqBody);
    return {
        isPublish: false,
        post: resp.BlogPosts[0]
    };
}

export const postPublishLoader = async ({ params }) => {
    return {
        isPublish: true,
        post: {
            name: '',
            type: 'markdown',
            title: '',
            language: 'zh_CN',
            markdown: '',
        }
    }
}

export const PostEdit = () => {
    const { isPublish, post } = useLoaderData();
    const navigate = useNavigate();

    const submitHandler = async (evt) => {
        evt.preventDefault();
        evt.stopPropagation();

        const postEle = document.getElementById("postEdit");
        const language = postEle.querySelector('.input.postLanguage').value;

        const variables = {
            post: {
                title: postEle.querySelector('.input.postTitle').value,
                name: postEle.querySelector('.input.postName').value,
                markdown: postEle.querySelector('.input.postMarkdown').value,
                type: postEle.querySelector('.input.postType').value,
            },
        };

        // check empty
        for (const k in variables.post) {
            if (!variables.post[k]) {
                alert(`Empty field: ${k}`);
                return;
            }
        }

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

        const resp = await request(getGraphqlAPI(), gqBody, variables);
        navigate(`/p/${resp.BlogAmendPost.name}/?force=1`);
    };

    return (
        <div id="postEdit" className='row align-items-start scrollable-content'>
            {/* blog posts */}
            <div className='col-md-9 posts'>
                <div className="container-fluid post" id={post.name} key={post.name}>
                    <div className="mb-3">
                        <label htmlFor="postTitle" className="form-label">Title</label>
                        <input
                            type="text"
                            className="form-control input postTitle"
                            defaultValue={post.title}
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="postName" className="form-label">Name</label>
                        <input
                            type="text"
                            className="form-control input postName"
                            {...isPublish ? {} : { readOnly: true }}
                            defaultValue={post.name}
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="postMarkdown" className="form-label">Markdown</label>
                        <textarea
                            className="form-control input postMarkdown"
                            defaultValue={post.markdown}
                            rows="10"
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="postLanguage" className="form-label">Language</label>
                        <select
                            className="form-select input postLanguage"
                            defaultValue={post.language}
                        >
                            <option value="en_US">en_US</option>
                            <option value="zh_CN">zh_CN</option>
                        </select>
                    </div>
                    <div className="mb-3">
                        <label htmlFor="postType" className="form-label">Type</label>
                        <select
                            className="form-select input postType"
                            defaultValue={post.type}
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
