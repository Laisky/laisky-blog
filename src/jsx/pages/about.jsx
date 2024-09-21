'use strict';

import React, { useState } from 'react';
import { Link } from 'react-router-dom';


export const About = () => {
    const [activeTab, setActiveTab] = useState('site');

    const handleTabClick = (tab) => {
        setActiveTab(tab);
    };

    return (
        <div id="about" className="container-fluid">
            {/* Tab title */}
            <ul className="nav nav-tabs" role="tablist" id="myTab">
                <li role="presentation" className="nav-item">
                    <a
                        className={`nav-link ${activeTab === 'site' ? 'active' : ''}`}
                        role="tab"
                        aria-controls="site"
                        aria-selected={activeTab === 'site'}
                        onClick={() => handleTabClick('site')}
                    >
                        This Site
                    </a>
                </li>
                <li className="nav-item" role="presentation">
                    <a
                        className={`nav-link ${activeTab === 'me' ? 'active' : ''}`}
                        role="tab"
                        aria-controls="me"
                        aria-selected={activeTab === 'me'}
                        onClick={() => handleTabClick('me')}
                    >
                        Me
                    </a>
                </li>
                <li className="nav-item" role="presentation">
                    <a
                        className={`nav-link ${activeTab === 'right' ? 'active' : ''}`}
                        role="tab"
                        aria-controls="right"
                        aria-selected={activeTab === 'right'}
                        onClick={() => handleTabClick('right')}
                    >
                        Copyright
                    </a>
                </li>
            </ul>

            {/* Tab panes */}
            <div className="tab-content" id="myTabContent">
                <div role="tabpanel" aria-labelledby="site-tab" className={`tab-pane ${activeTab === 'site' ? 'active' : ''}`} id="site">
                    <article>
                        <h2>About this site</h2>
                        <p>built with Nginx & Tornado & GraphQL & MongoDB (long neglected)</p>
                        <p>Backend: <Link target="_blank" to="https://github.com/Laisky/laisky-blog">https://github.com/Laisky/laisky-blog</Link></p>
                        <p>GraphQL UI: <Link target="_blank" to="https://gq.laisky.com/ui/">https://gq.laisky.com/ui/</Link></p>
                        <p>GraphQL Repo: <Link target="_blank" to="https://github.com/Laisky/laisky-blog-graphql">https://github.com/Laisky/laisky-blog-graphql</Link></p>
                    </article>
                </div>
                <div role="tabpanel" aria-labelledby="me-tab" className={`tab-pane ${activeTab === 'me' ? 'active' : ''}`} id="me">
                    <article>
                        <h2>About Me</h2>
                        <p><i className="bi bi-envelope"></i>Email: public@laisky.com</p>
                        <p><i className="bi bi-telegram"></i>Channel: <Link target="_blank" to="https://t.me/laiskynotes">https://t.me/laiskynotes</Link></p>
                        <p><i className="bi bi-person-circle"></i>About Me: <Link target="_blank" to="https://about.me/laisky">https://about.me/laisky</Link></p>
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
        </div>
    );
};
