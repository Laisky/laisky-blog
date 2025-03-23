'use strict';

import * as bootstrap from 'bootstrap';
import { gql } from 'graphql-request';
import 'https://s3.laisky.com/static/prism/1.29.0/prism.js';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Comments } from '../components/comments.jsx';
import jsutils from '@laisky/js-utils';

import {
    formatTs,
    getCurrentUsername, getUserLanguage,
    graphqlQuery,
    KvKeyLanguage,
    KvKeyPrefixCache
} from '../library/base.jsx';
import mermaid from 'mermaid';


export const loader = async ({ params }) => {
    const cacheKey = KvKeyPrefixCache + await jsutils.SHA256(`post:${await getUserLanguage()}:${params.name}`);
    const cacheData = await jsutils.GetCache(cacheKey);
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

    const resp = await graphqlQuery(gqBody);
    const result = resp.BlogPosts[0];

    // update cache
    await jsutils.SetCache(cacheKey, result);

    return result;
}

export const historyLoader = async ({ params }) => {
    const cacheKey = KvKeyPrefixCache + await jsutils.SHA256(`postHistory:${await getUserLanguage()}:${params.name}`);
    const cacheData = await jsutils.GetCache(cacheKey);
    if (cacheData) {
        return cacheData;
    }

    const gqBody = gql`
        query Blog {
            BlogPostHistory(
                file_id: "${params.name}"
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
        }`;

    const resp = await graphqlQuery(gqBody);
    const result = resp.BlogPostHistory;

    // update cache
    await jsutils.SetCache(cacheKey, result);

    return result;
};


export const Post = ({ isHistory }) => {
    isHistory = isHistory === 'true';
    const params = useParams();
    const [content, setContent] = useState(
        <div className='col-md-8 col-lg-9 posts placeholder-glow'>
            <span className="placeholder col-7"></span>
            <span className="placeholder col-4"></span>
            <span className="placeholder col-4"></span>
            <span className="placeholder col-6"></span>
            <span className="placeholder col-8"></span>
        </div>
    );
    const [language, setLanguage] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        (async () => {
            let post;
            if (isHistory) {
                post = await historyLoader({ params });
            } else {
                post = await loader({ params });
            }

            const postTail = await loadPostTails(post);

            // change page title
            document.title = isHistory ? `[History] ${post.title}` : post.title;

            const content = (
                <>
                    <div className='col-md-8 col-lg-9 posts'>
                        <div className="container-fluid post" id={post.name} key={post.name}>
                            <h2 className="post-title">
                                <Link to={`/p/${post.name}/`}>{isHistory ? `[History] ${post.title}` : post.title}</Link>
                            </h2>
                            <div className="post-meta">
                                <span >published: </span>
                                <span data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={`"${post.created_at}"`}>{formatTs(post.created_at)}
                                </span>
                            </div>
                            <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }}>
                            </div>
                            {postTail}
                            <Comments postName={params.name} />
                            {/* <DiscussionEmbed
                                shortname='laisky'
                                config={
                                    {
                                        url: `https://laisky.com/p/${params.name}/`,
                                        identifier: params.name,
                                        title: params.name,
                                        language: 'en_US' //e.g. for Traditional Chinese (Taiwan)
                                    }
                                }
                            /> */}
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

        (async () => {
            bindPostImageModal();
            renderCode();
            await renderMathjax();
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

            // Add this line to enhance menu items with tooltips
            enhancePostMenu();

            parseAndReplacePostSeries();
            try {
                mermaid.run();
            } catch (e) {
                console.error(`failed to render mermaid: ${e}`);
            }
        })();
    }, [content]);

    // Also add a window resize listener to the component
    useEffect(() => {
        // Re-check for overflowing text when window resizes
        const handleResize = () => {
            enhancePostMenu();
        };

        window.addEventListener('resize', handleResize);

        // Clean up the event listener
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const watchLanguageChange = async () => {
        await jsutils.KvAddListener(KvKeyLanguage, async (key, op, oldVal, newVal) => {
            if (op !== jsutils.KvOp.SET || key != KvKeyLanguage || oldVal === newVal) {
                return;
            }

            setLanguage(newVal);
        }, "page_post")
    };

    return (
        <div id="post" className='row align-items-start scrollable-content'>
            {content}
        </div>
    )
}



/**
 * Enhance post menu with tooltip to display full text
 */
const enhancePostMenu = () => {
    try {
        // Delay the execution to ensure DOM is fully rendered
        setTimeout(() => {
            // Select all links in the post-menu
            const menuLinks = document.querySelectorAll('.post-menu a');

            // First dispose all existing tooltips to prevent duplicate instances
            menuLinks.forEach(link => {
                const tooltip = bootstrap.Tooltip.getInstance(link);
                if (tooltip) {
                    tooltip.dispose();
                }
            });

            menuLinks.forEach(link => {
                // Get dimensions
                const linkText = link.textContent.trim();

                // Create temp element to measure text width accurately
                const tempSpan = document.createElement('span');
                tempSpan.style.visibility = 'hidden';
                tempSpan.style.position = 'absolute';
                tempSpan.style.whiteSpace = 'nowrap';
                tempSpan.style.font = window.getComputedStyle(link).font;
                tempSpan.textContent = linkText;
                document.body.appendChild(tempSpan);

                // Compare text width with available width
                const textWidth = tempSpan.offsetWidth;
                const availableWidth = link.offsetWidth - 20; // Account for padding
                document.body.removeChild(tempSpan);

                // Only set up tooltip if text is actually truncated
                if (textWidth > availableWidth) {
                    // Use a data attribute to mark this as having a tooltip
                    link.setAttribute('data-bs-toggle', 'tooltip');
                    link.setAttribute('data-bs-placement', 'right');
                    link.setAttribute('data-bs-title', linkText);
                    link.setAttribute('data-bs-container', 'body');

                    // Initialize the tooltip with simpler options
                    new bootstrap.Tooltip(link, {
                        trigger: 'hover focus',
                        boundary: 'window',
                        offset: [0, 10]
                    });

                    // Ensure tooltip hides on mouseleave
                    link.addEventListener('mouseleave', () => {
                        const tooltip = bootstrap.Tooltip.getInstance(link);
                        if (tooltip) {
                            tooltip.hide();
                        }
                    });

                    // Hide tooltip on click
                    link.addEventListener('click', () => {
                        const tooltip = bootstrap.Tooltip.getInstance(link);
                        if (tooltip) {
                            tooltip.hide();
                        }
                    });
                } else {
                    // Remove tooltip attributes if not needed
                    link.removeAttribute('data-bs-toggle');
                    link.removeAttribute('data-bs-placement');
                    link.removeAttribute('data-bs-title');
                    link.removeAttribute('data-bs-container');
                }
            });
        }, 500);
    } catch (e) {
        console.error('Failed to enhance post menu:', e);
    }
};


const renderCode = () => {
    try {
        document.querySelectorAll('pre > code').forEach((ele) => {
            window.Prism && window.Prism.highlightAllUnder(ele.closest('pre'));
        });
    } catch (e) {
        console.error(`failed to render code: ${e}`);
    }
}

const renderMathjax = () => {
    try {
        if (!window.MathJax) {
            const script = document.createElement('script');
            script.src = "https://s3.laisky.com/static/mathjax/2.7.3/MathJax-2.7.3/MathJax.js?config=TeX-MML-AM_CHTML";
            script.async = true;
            script.onload = () => {
                window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
            };
            script.onerror = (e) => {
                console.error(`failed to load mathjax: ${e}`);
            };
            document.head.appendChild(script);
        } else {
            window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
        }
    } catch (e) {
        console.error(`failed to render mathjax: ${e}`);
    }
};

const loadPostTails = async (post) => {
    let articleEditable;
    if (await getCurrentUsername()) {
        articleEditable = <Link to={`/edit/${post.name}/`}>Edit</Link>;
    }


    // dropdown options for history
    let articleHistory = [];
    let maxHistory = 10;
    if (post['arweave_id']) {
        for (let i = 0; i < post['arweave_id'].length; i++) {
            if (i >= maxHistory) {
                break;
            }

            let history = post['arweave_id'][i];
            articleHistory.push(
                <li key={history.id}><Link to={`/p/history/${history.id}/`}>{history.time}</Link></li>
            );
        }

        articleHistory = (
            <div className="dropdown post-history">
                <button className="btn btn-default dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="true">
                    History
                    <span className="caret"></span>
                </button>
                <ul className="dropdown-menu">
                    {articleHistory}
                </ul>
            </div>
        );
    }

    return (
        <div className="post-tail">
            {articleHistory}
            {articleEditable}
        </div>
    );
};


let imgModal;

const bindPostImageModal = () => {
    if (!imgModal) {
        const modalEle = document.getElementById('showImageModal');
        imgModal = new bootstrap.Modal(modalEle);

        modalEle.addEventListener('click', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();

            imgModal.hide();
        });
    }

    // bind click event to post images
    const postImgs = document.querySelectorAll('.post-content p img');
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


// render post series
const parseAndReplacePostSeries = async () => {
    const seriesElements = document.querySelectorAll('.post .post-content div.post_series');
    const tasks = Array.from(seriesElements).map(async (seEle) => {
        const postkey = seEle.getAttribute('key');
        const se = await loadSeries(postkey);
        if (!se) {
            return;
        }

        let html = parseSeriesHTML(se);
        for (let i = 0; i < se.children.length; i++) {
            html += await parseSeriesChildren(se.children[i].key);
        }

        html = `
            <div class="card">
            <div class="card-body">
                <h5 class="card-title">${se.remark} Serials</h5>
                <ul class="card-text">
                    ${html}
                </ul>
            </div>
            </div>`;
        seEle.innerHTML = html;
    });

    await Promise.all(tasks);
}


async function loadSeries(postkey) {
    const cacheKey = KvKeyPrefixCache + await jsutils.SHA256(`postSeries:${postkey}`);
    const cacheData = await jsutils.GetCache(cacheKey);
    if (cacheData) {
        return cacheData;
    }

    const gqBody = gql`
        query {
            GetBlogPostSeries(
                key: "${postkey}"
            ) {
                remark
                posts {
                    name
                    title
                }
                children {
                    key
                }
            }
        }
    `;

    const resp = await graphqlQuery(gqBody);

    if (resp.GetBlogPostSeries.length < 1) {
        return null;
    }

    const result = resp.GetBlogPostSeries[0];

    // update cache
    await jsutils.SetCache(cacheKey, result);

    return result;
}

function parseSeriesHTML(se) {
    let html = '';
    for (let i = 0; i < se.posts.length; i++) {
        let p = se.posts[i];
        html += `<li><a href="https://blog.laisky.com/p/${p.name}/">${p.title}</a></li>`;
    }

    return html;
}

async function parseSeriesChildren(seriesKey) {
    let se = await loadSeries(seriesKey);
    let sid = `series-${se.remark}`;
    let html = parseSeriesHTML(se);
    if (se.children.length != 0) {
        for (i = 0; i < se.children.length; i++) {
            html += parseSeriesChildren(se.children[i].key);
        }
    }

    html = `
            <li>
                <a class="btn btn-light" data-bs-toggle="collapse" href="#${sid}" role="button" aria-expanded="false" aria-controls="${sid}">
                    <i class="bi bi-filter-left"></i>${se.remark} Serials：
                </a>
                <div id="${sid}" class="collapse">
                    <div class="card card-body">
                        <ul>
                            ${html}
                        </ul>
                    </div>
                </div>
            </li>
        `

    return html;
}
