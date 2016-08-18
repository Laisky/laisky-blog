'use strict';

import React from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, Redirect,
         Link, IndexRedirect, browserHistory } from 'react-router';
import { Provider } from 'react-redux';

import { App } from './pages/app.jsx';
import { PageNotFound } from './pages/404.jsx';
import { Archives } from './pages/archives.jsx';
import { Post } from './pages/post.jsx';
import { AboutMe } from './pages/aboutme.jsx';
import { Login } from './pages/login.jsx';
import { Publish, Amend } from './pages/publish.jsx';
import {RootReducer, store} from './reducers';


ReactDOM.render(
    <Provider store={store}>
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
    </Router>
    </Provider>,
    document.getElementById('body')
);
