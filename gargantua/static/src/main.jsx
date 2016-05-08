'use strict';

import React from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, Redirect,
         Link, IndexRedirect, browserHistory } from 'react-router';

import { App } from './jsx/app.jsx';
import { PageNotFound } from './jsx/404.jsx';
import { Archives } from './jsx/archives.jsx';
import { Post } from './jsx/post.jsx';
import { AboutMe } from './jsx/aboutme.jsx';
import { Login } from './jsx/login.jsx';
import { Publish, Amend } from './jsx/publish.jsx';


ReactDOM.render(
    <Router history={browserHistory}>
        <Route name="home" path="/" component={App}>
            <IndexRedirect to="/archives/1/" />
            <Route name="archives" path="archives/:page/" component={Archives} />
            <Route name="publish" path="publish/" component={Publish} />
            <Route name="amend" path="amend/:pid/" component={Amend} />
            <Route name="post" path="p/:pid/" component={Post} />
            <Route name="aboutme" path="about/" component={AboutMe} />
            <Route name="login" path="login/" component={Login} />
            <Route name="notfound" path="404.html" component={PageNotFound} />
        </Route>
        <Redirect from="*" to="/404.html" />
    </Router>,
    document.getElementById('body')
);
