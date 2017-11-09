'use strict';

import React from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, Redirect,
         Link, IndexRedirect, browserHistory } from 'react-router';
import { Provider } from 'react-redux';

import { App } from './pages/app.jsx';
import { PageNotFound } from './pages/404.jsx';
import { Archives } from './pages/archives.jsx';
import { Post, PostCategories } from './pages/post.jsx';
import { About } from './pages/about.jsx';
import { Login } from './pages/login.jsx';
import { Publish, Amend } from './pages/publish.jsx';
import { RootReducer, store } from './reducers';
import { AdminPage, CategoriesConsole } from './pages/admin.jsx';


ReactDOM.render(
    <Provider store={store}>
    <Router history={browserHistory} onUpdate={() => {window.ga || window.ga('send', 'pageview', location.pathname);}}>
        <Route name="home" path="/" component={App}>
            <IndexRedirect to="/archives/1/" />
            <Route name="archives" path="archives/:page/" component={Archives} />
            <Route name="publish" path="publish/" component={Publish} />
            <Route name="amend" path="amend/:pid/" component={Amend} />
            <Route name="post" path="p/:pid/" component={Post} />
            <Route name="categories" path="cate/(:cateid/)" component={PostCategories} />
            <Route name="about" path="about/" component={About} />
            <Route name="login" path="login/" component={Login} />
            <Route name="notfound" path="404.html" component={PageNotFound} />
            <Route name="admin" path="admin/" component={AdminPage} >
                <Route name="admin-category" path="cate/" component={CategoriesConsole}></Route>
            </Route>
        </Route>
        <Redirect from="*" to="/404.html" />
    </Router>
    </Provider>,
    document.getElementById('body')
);
