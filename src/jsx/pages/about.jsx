'use strict';

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, UserCircle } from 'lucide-react';


export const About = () => {
    const [activeTab, setActiveTab] = useState('site');

    const handleTabClick = (tab) => {
        setActiveTab(tab);
    };

    return (
        <div className="container-xl px-3 px-xl-0 scrollable-content">
            <section id="about">
                <ul className="nav nav-tabs" role="tablist" id="myTab">
                    <li role="presentation" className="nav-item">
                        <button
                            type="button"
                            className={`nav-link ${activeTab === 'site' ? 'active' : ''}`}
                            role="tab"
                            aria-controls="site"
                            aria-selected={activeTab === 'site'}
                            onClick={() => handleTabClick('site')}
                        >
                            This Site
                        </button>
                    </li>
                    <li className="nav-item" role="presentation">
                        <button
                            type="button"
                            className={`nav-link ${activeTab === 'me' ? 'active' : ''}`}
                            role="tab"
                            aria-controls="me"
                            aria-selected={activeTab === 'me'}
                            onClick={() => handleTabClick('me')}
                        >
                            Me
                        </button>
                    </li>
                    <li className="nav-item" role="presentation">
                        <button
                            type="button"
                            className={`nav-link ${activeTab === 'right' ? 'active' : ''}`}
                            role="tab"
                            aria-controls="right"
                            aria-selected={activeTab === 'right'}
                            onClick={() => handleTabClick('right')}
                        >
                            Copyright
                        </button>
                    </li>
                </ul>

                <div className="tab-content" id="myTabContent">
                    <div role="tabpanel" aria-labelledby="site-tab" className={`tab-pane ${activeTab === 'site' ? 'active' : ''}`} id="site">
                        <article>
                            <h2>About this site</h2>
                            <p>Built with React, GraphQL, and MongoDB.</p>
                            <p>Backend: <Link target="_blank" to="https://github.com/Laisky/laisky-blog/tree/v2" rel="noreferrer">https://github.com/Laisky/laisky-blog</Link></p>
                            <p>GraphQL UI: <Link target="_blank" to="https://gq_v2.laisky.com/ui/" rel="noreferrer">https://gq_v2.laisky.com/ui/</Link></p>
                            <p>GraphQL Repo: <Link target="_blank" to="https://github.com/Laisky/laisky-blog-graphql" rel="noreferrer">https://github.com/Laisky/laisky-blog-graphql</Link></p>
                        </article>
                    </div>
                    <div role="tabpanel" aria-labelledby="me-tab" className={`tab-pane ${activeTab === 'me' ? 'active' : ''}`} id="me">
                        <article>
                            <h2>About Me</h2>
                            <p><Mail size={18} className="me-2 align-text-bottom" /> Email: public@laisky.com</p>
                            <p><Send size={18} className="me-2 align-text-bottom" /> Channel: <Link target="_blank" to="https://t.me/laiskynotes" rel="noreferrer">https://t.me/laiskynotes</Link></p>
                            <p><UserCircle size={18} className="me-2 align-text-bottom" /> About Me: <Link target="_blank" to="https://about.me/laisky" rel="noreferrer">https://about.me/laisky</Link></p>
                        </article>
                    </div>
                    <div role="tabpanel" aria-labelledby="right-tab" className={`tab-pane ${activeTab === 'right' ? 'active' : ''}`} id="right">
                        <article>
                            <h2>Copyright</h2>
                            <p>The content of this site is available under the "Attribution 4.0 International (CC BY 4.0)" license, meaning that the content can be used freely as long as the attribution is preserved.</p>
                            <img src="https://s3.laisky.com/uploads/images/cc-by-4_0.jpg" alt="cc by 4.0" />
                        </article>
                    </div>
                </div>
            </section>
        </div>
    );
};
