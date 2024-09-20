'use strict';

import React, { useEffect } from 'react';
import { Link, useParams, useLoaderData } from 'react-router-dom';
import { gql, request } from 'graphql-request'
import * as bootstrap from 'bootstrap'

import { GraphqlAPI, formatTimeStr, getCurrentUsername, getUserLanguage } from '../library/base.jsx';


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
    return resp.BlogPosts[0];
}

export const Post = () => {
    const { name } = useParams();
    const post = useLoaderData();
    let imgModalBinded = false;

    useEffect(() => {
        bindPostImageModal();
    }, []);

    const getPostTails = (post) => {
        let articleEditable;
        if (getCurrentUsername()) {
            articleEditable = <Link to={`/amend/${post.name}/`}>编辑</Link>;
        }

        return articleEditable
    };

    const bindPostImageModal = () => {
        if (imgModalBinded) return;
        imgModalBinded = true;

        const imgModal = new bootstrap.Modal(document.getElementById('showImageModal'));

        // bind click event to post images
        const postImgs = document.querySelectorAll('.post-content img');
        postImgs.forEach(img => {
            img.addEventListener('click', () => {
                // Create a new img element
                const newImg = document.createElement('img');
                newImg.src = img.src;
                newImg.classList.add('img-fluid'); // Add any necessary classes

                // Clear the existing content in the modal body and append the new img element
                const modalBody = document.getElementById('showImageModal').querySelector('.modal-body');
                modalBody.innerHTML = ''; // Clear existing content
                modalBody.appendChild(newImg);

                // Show the modal
                imgModal.show();
            });
        });
    };

    return (
        <div id="post" className='row align-items-start'>
            {/* blog posts */}
            <div className='col-md-9 posts'>
                <div className="container-fluid post" id={post.name} key={post.name}>
                    <h2 className="post-title">
                        <Link to={`/p/${post.name}/`}>{post.title}</Link>
                    </h2>
                    <div className="post-meta">
                        <span>published: </span>
                        <span>{formatTimeStr(post.created_at)}</span>
                    </div>
                    <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }}>
                    </div>
                    <div className="post-tail">
                        {getPostTails(post)}
                    </div>
                </div>
            </div>
        </div>
    )
}
