/**
 * aboutme
 */

'use strict';

import React from 'react';

import { BaseComponent } from '../components/base.jsx';
import { Redirect } from '../components/redirect.jsx';


class AboutMe extends BaseComponent {
    render() {
        return (
            <div id="aboutme" className="container-fluid">
                <article className="aboutme">
                    <h2>关于我</h2>
                    <p>我显然并没有时间写……</p>
                </article>
            </div>
        );
    };
}


export { AboutMe };