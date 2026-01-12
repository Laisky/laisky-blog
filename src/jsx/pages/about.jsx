'use strict';

import { Mail, Send, UserCircle } from 'lucide-react';
import React from 'react';
import { Link, useParams } from 'react-router-dom';

export const About = () => {
    const { tab: activeTab = 'site' } = useParams();

    return (
        <div className="scrollable-content">
            <section id="about">
                <ul className="nav nav-tabs" role="tablist" id="myTab">
                    <li role="presentation" className="nav-item">
                        <Link
                            className={`nav-link ${activeTab === 'site' ? 'active' : ''}`}
                            to="/about/site/"
                            role="tab"
                            aria-controls="site"
                            aria-selected={activeTab === 'site'}
                        >
                            This Site
                        </Link>
                    </li>
                    <li className="nav-item" role="presentation">
                        <Link
                            className={`nav-link ${activeTab === 'me' ? 'active' : ''}`}
                            to="/about/me/"
                            role="tab"
                            aria-controls="me"
                            aria-selected={activeTab === 'me'}
                        >
                            Me
                        </Link>
                    </li>
                    <li className="nav-item" role="presentation">
                        <Link
                            className={`nav-link ${activeTab === 'copyright' ? 'active' : ''}`}
                            to="/about/copyright/"
                            role="tab"
                            aria-controls="copyright"
                            aria-selected={activeTab === 'copyright'}
                        >
                            Copyright
                        </Link>
                    </li>
                </ul>

                <div className="tab-content" id="myTabContent">
                    <div
                        role="tabpanel"
                        aria-labelledby="site-tab"
                        className={`tab-pane ${activeTab === 'site' ? 'active' : ''}`}
                        id="site"
                    >
                        <article>
                            <h2>About this site</h2>
                            <p>Built with React, GraphQL, and MongoDB.</p>
                            <p>
                                Backend:{' '}
                                <Link
                                    target="_blank"
                                    to="https://github.com/Laisky/laisky-blog/tree/v2"
                                    rel="noreferrer"
                                >
                                    https://github.com/Laisky/laisky-blog
                                </Link>
                            </p>
                            <p>
                                GraphQL UI:{' '}
                                <Link
                                    target="_blank"
                                    to="https://gq_v2.laisky.com/ui/"
                                    rel="noreferrer"
                                >
                                    https://gq_v2.laisky.com/ui/
                                </Link>
                            </p>
                            <p>
                                GraphQL Repo:{' '}
                                <Link
                                    target="_blank"
                                    to="https://github.com/Laisky/laisky-blog-graphql"
                                    rel="noreferrer"
                                >
                                    https://github.com/Laisky/laisky-blog-graphql
                                </Link>
                            </p>
                        </article>
                    </div>
                    <div
                        role="tabpanel"
                        aria-labelledby="me-tab"
                        className={`tab-pane ${activeTab === 'me' ? 'active' : ''}`}
                        id="me"
                    >
                        <article>
                            <h2>About Me</h2>
                            <div style={{ marginBottom: '1rem' }}>
                                <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                                    Hi there{' '}
                                    <span role="img" aria-label="wave">
                                        👋
                                    </span>
                                    , I'm Laisky Cai
                                </span>
                            </div>
                            <div style={{ marginBottom: '0.1rem' }}>
                                <span>
                                    Software Engineer since 2014, familiar with Golang, Python, and
                                    ECMAScript, focus on Platform/Backend Development.
                                    <br />
                                    <br />
                                    Recently working on LLM Agent, Trusted Execution Environment
                                    (TEE), Confidential Computing, Blockchain Protocol, Zero-Trust
                                    Infrastructure.
                                    <br />
                                    <br />
                                    Passionate about reading, drawing lessons from history.
                                    Programming is my language of creation, and I'm obsessed with
                                    building tools that make life easier for people.
                                    <br />
                                </span>
                            </div>
                            <div>
                                <Link
                                    target="_blank"
                                    to="https://blog.laisky.com/archives/1/"
                                    rel="noreferrer"
                                    style={{ marginRight: '1.5rem' }}
                                >
                                    Blog
                                </Link>
                                <Link
                                    target="_blank"
                                    to="https://github.com/Laisky"
                                    rel="noreferrer"
                                    style={{ marginRight: '1.5rem' }}
                                >
                                    GitHub
                                </Link>
                                <Link
                                    target="_blank"
                                    to="https://t.me/laiskynotes"
                                    rel="noreferrer"
                                    style={{ marginRight: '1.5rem' }}
                                >
                                    Channel
                                </Link>
                                <Link
                                    target="_blank"
                                    to="https://x.com/LaiskyCai"
                                    rel="noreferrer"
                                    style={{ marginRight: '1.5rem' }}
                                >
                                    Twitter/X
                                </Link>
                            </div>
                        </article>
                    </div>
                    <div
                        role="tabpanel"
                        aria-labelledby="copyright-tab"
                        className={`tab-pane ${activeTab === 'copyright' ? 'active' : ''}`}
                        id="copyright"
                    >
                        <article>
                            <h2>Copyright</h2>
                            <p>
                                The content of this site is available under the "Attribution 4.0
                                International (CC BY 4.0)" license, meaning that the content can be
                                used freely as long as the attribution is preserved.
                            </p>
                            <img
                                src="https://s3.laisky.com/uploads/images/cc-by-4_0.jpg"
                                alt="cc by 4.0"
                            />
                        </article>
                    </div>
                </div>
            </section>
        </div>
    );
};
