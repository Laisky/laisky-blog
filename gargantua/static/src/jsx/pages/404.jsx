/**
 * 404 not found page
 */

'use strict';

import React from 'react';

import { BaseComponent } from '../components/base.jsx';
import { Redirect } from '../components/redirect.jsx';


class PageNotFound extends BaseComponent {
    render() {
        return <div id="pagenotfound">
            <Redirect waitSec="2"
                title="页面不存在"
                nextDataUrl="/api/posts/get-post-by-page/?page=1"
                nextUrl="/archives/1/"
                targetSelector="body > .container" />
        </div>
    };
}

export { PageNotFound };
