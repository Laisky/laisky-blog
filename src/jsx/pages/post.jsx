'use strict';

import * as bootstrap from 'bootstrap';
import { gql, request } from 'graphql-request';
import 'https://s3.laisky.com/static/prism/1.29.0/prism.js';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { DurationDay, formatTimeStr, getCurrentUsername, getUserLanguage, GraphqlAPI, KvKeyLanguage, KvKeyPrefixCache } from '../library/base.jsx';
import { GetCache, KvAddListener, KvOp, SetCache, SHA256 } from '../library/libs.js';


export const loader = async ({ params }) => {
    const cacheKey = KvKeyPrefixCache + await SHA256(`${await getUserLanguage()}:${params.name}`);
    const cacheData = await GetCache(cacheKey);
    if (cacheData) {
        return cacheData;
    }

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
    const result = resp.BlogPosts[0];

    // update cache
    await SetCache(cacheKey, result, DurationDay);

    return result;
}

export const Post = () => {
    const params = useParams();
    const [content, setContent] = useState('');
    const [language, setLanguage] = useState(null);
    let imgModalBinded = false;

    useEffect(() => {
        (async () => {
            const post = await loader({ params });
            const postTail = await loadPostTails();

            bindPostImageModal();
            renderCode();
            watchLanguageChange()

            const content = <div className='col-md-9 col-lg-10 posts'>
                <div className="container-fluid post" id={post.name} key={post.name}>
                    <h2 className="post-title">
                        <Link to={`/p/${post.name}/`}>{post.title}</Link>
                    </h2>
                    <div className="post-meta">
                        <span>published_at: </span>
                        <span className="time">{formatTimeStr(post.created_at)}</span>
                    </div>
                    <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }}>
                    </div>
                    <div className="post-tail">
                        {postTail}
                    </div>
                </div>
            </div>;

            setContent(content);
        })();
    }, [params.name, language]);

    const watchLanguageChange = () => {
        KvAddListener(KvKeyLanguage, async (key, op, oldVal, newVal) => {
            if (op !== KvOp.SET || key != KvKeyLanguage || oldVal === newVal) {
                return;
            }

            setLanguage(newVal);
        }, "page_post")
    };

    const loadPostTails = async () => {
        let articleEditable;
        if (await getCurrentUsername()) {
            articleEditable = <Link to={`/amend/${params.name}/`}>Edit</Link>;
        }

        return articleEditable;
    };

    const renderCode = () => {
        document.querySelectorAll('pre > code').forEach((ele) => {
            window.Prism && window.Prism.highlightAllUnder(ele.closest('pre'));
        });
    }

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
        <div id="post" className='row align-items-start scrollable-content'>
            {content}
        </div>
    )
}
