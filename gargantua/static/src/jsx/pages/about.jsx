/**
 * aboutme
 */

'use strict';

import React from 'react';
import { Link } from 'react-router';
import { BaseComponent } from '../components/base.jsx';



export class About extends BaseComponent {
    render() {
        return (
            <div id="about" className="container-fluid">
                {/* Tab title */}
                <ul className="nav nav-tabs" ref="myTabs" role="tablist" id="myTab">
                    <li role="presentation" className="nav-item">
                        <a className="nav-link active" role="tab" aria-controls="site" aria-selected="true" href="#site" data-toggle="tab">This Site</a>
                    </li>
                    <li className="nav-item" role="presentation">
                        <a className="nav-link" role="tab" aria-controls="me" aria-selected="false" href="#me" data-toggle="tab">Me</a>
                    </li>
                    <li className="nav-item" role="presentation">
                        <a className="nav-link" role="tab" aria-controls="right" aria-selected="false" href="#right" data-toggle="tab">Copyright</a>
                    </li>
                </ul>

                {/* Tab panes */}
                <div className="tab-content" id="myTabContent">
                    <div role="tabpanel" aria-labelledby="site-tab" className="tab-pane active" id="site">
                        <article>
                            <h2>About this site</h2>
                            <p>built with Nginx & Tornado & GraphQL & MongoDB (long neglected)</p>
                            <p>Backend: <Link target="_blank" to="https://github.com/Laisky/laisky-blog">https://github.com/Laisky/laisky-blog</Link></p>
                            <p>GraphQL UI: <Link target="_blank" to="https://gq.laisky.com/ui/">https://gq.laisky.com/ui/</Link></p>
                            <p>GraphQL Repo: <Link target="_blank" to="https://github.com/Laisky/laisky-blog-graphql">https://github.com/Laisky/laisky-blog-graphql</Link></p>
                        </article>
                    </div>
                    <div role="tabpanel" aria-labelledby="me-tab" className="tab-pane" id="me">
                        <article>
                            <h2>AboutMe</h2>
                            <p><i className="bi bi-envelop"></i>Email: public@laisky.com</p>
                            <p><i className="bi bi-telegram"></i>Channel: <Link target="_blank" to="https://t.me/laiskynotes">https://t.me/laiskynotes</Link></p>
                            <p><i className="bi bi-telegram"></i>AboutMe: <Link target="_blank" to="https://about.me/laisky">https://about.me/laisky</Link></p>
                        </article>
                    </div>
                    <div role="tabpanel" aria-labelledby="right-tab" className="tab-pane" id="right">
                        <article>
                            <h2>Copyright</h2>
                            <p>The content of this site is available under the "Attribution 4.0 International (CC BY 4.0)" license, meaning that the content can be used freely as long as the attribution is preserved.</p>
                            <img src="https://s3.laisky.com/uploads/images/cc-by-4_0.jpg" alt="cc by 4.0" />
                        </article>
                    </div>
                </div>
            </div>
        );
    }
}
