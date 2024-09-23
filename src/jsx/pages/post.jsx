'use strict';

import * as bootstrap from 'bootstrap';
import { DiscussionEmbed } from 'disqus-react';
import { gql, request } from 'graphql-request';
import 'https://s3.laisky.com/static/prism/1.29.0/prism.js';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
    DurationDay,
    formatTs,
    getCurrentUsername,
    getGraphqlAPI,
    getUserLanguage,
    KvKeyLanguage,
    KvKeyPrefixCache
} from '../library/base.jsx';
import {
    GetCache,
    KvAddListener, KvOp,
    SetCache,
    SHA256
} from '../library/libs.js';


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

    const resp = await request(getGraphqlAPI(), gqBody);
    const result = resp.BlogPosts[0];

    // update cache
    await SetCache(cacheKey, result, DurationDay);

    return result;
}

export const Post = () => {
    const params = useParams();
    const [content, setContent] = useState(null);
    const [language, setLanguage] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        (async () => {
            const post = await loader({ params });
            const postTail = await loadPostTails(post);

            const content = (
                <>
                    <div className='col-md-8 col-lg-9 posts'>
                        <div className="container-fluid post" id={post.name} key={post.name}>
                            <h2 className="post-title">
                                <Link to={`/p/${post.name}/`}>{post.title}</Link>
                            </h2>
                            <div className="post-meta">
                                <span >published: </span>
                                <span data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={`"${post.created_at}"`}>{formatTs(post.created_at)}
                                </span>
                            </div>
                            <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }}>
                            </div>
                            {postTail}
                        </div>
                    </div>
                    <div className="d-none d-md-block col-md-3 col-lg-2 post-menu" dangerouslySetInnerHTML={{ __html: post.menu }}>
                    </div>
                </>
            );

            setContent(content);
        })();
    }, [params.name, language]);

    // after render
    useEffect(() => {
        if (!content) {
            return;
        }

        bindPostImageModal();
        renderCode();
        watchLanguageChange()

        // enable tooltips
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
        const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

        // enable menu
        try {
            const scrollSpy = new bootstrap.ScrollSpy(
                document.querySelector('#post'),
                {
                    target: '#post-menu',
                    smoothScroll: true,
                });
        } catch (e) {
            console.error(`failed to enable scrollspy: ${e}`);
        }
    }, [content]);

    const watchLanguageChange = () => {
        KvAddListener(KvKeyLanguage, async (key, op, oldVal, newVal) => {
            if (op !== KvOp.SET || key != KvKeyLanguage || oldVal === newVal) {
                return;
            }

            setLanguage(newVal);
        }, "page_post")
    };

    const loadPostTails = async (post) => {
        let articleEditable;
        if (await getCurrentUsername()) {
            articleEditable = <Link to={`/edit/${params.name}/`}>Edit</Link>;
        }

        const postComment = <DiscussionEmbed
            shortname='laisky'
            config={
                {
                    url: `https://laisky.com/p/${params.name}/`,
                    identifier: params.name,
                    title: params.name,
                    language: 'en_US' //e.g. for Traditional Chinese (Taiwan)
                }
            }
        />;

        return (
            <div className="post-tail">
                {articleEditable}
                {postComment}
            </div>
        );
    };

    const renderCode = () => {
        document.querySelectorAll('pre > code').forEach((ele) => {
            window.Prism && window.Prism.highlightAllUnder(ele.closest('pre'));
        });
    }

    const bindPostImageModal = () => {
        const imgModal = new bootstrap.Modal(document.getElementById('showImageModal'));

        // bind click event to post images
        const postImgs = document.querySelectorAll('.post-content p > img');
        postImgs.forEach(img => {
            if (img.dataset.bindmodal) {
                return;
            }
            img.dataset.bindmodal = 'true';

            img.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();

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
