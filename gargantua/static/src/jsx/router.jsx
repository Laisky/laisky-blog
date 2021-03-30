'use strict';

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { browserHistory, IndexRedirect, Redirect, Route, Router } from 'react-router';
import { Tweet, TwitterPage } from './components/tweet.jsx';
import { PageNotFound } from './pages/404.jsx';
import { About } from './pages/about.jsx';
import { AdminPage, CategoriesConsole } from './pages/admin.jsx';
import { App } from './pages/app.jsx';
import { Archives } from './pages/archives.jsx';
import { Login } from './pages/login.jsx';
import { Post, PostCategories } from './pages/post.jsx';
import { Amend, Publish } from './pages/publish.jsx';
import { store } from './reducers';



ReactDOM.render(
    <Provider store={store}>
        <Router history={browserHistory} onUpdate={() => { window.ga && window.ga('send', 'pageview', location.pathname); }}>
            <Route name="home" path="/" component={App}>
                <IndexRedirect to="/archives/1/" />
                <Route name="archives" path="archives/:page/" component={Archives} />
                <Route name="publish" path="publish/" component={Publish} />
                <Route name="amend" path="amend/:postname/" component={Amend} />
                <Route name="post" path="p/:pid/" component={Post} />
                <Route name="categories" path="cate/(:cateURL/)" component={PostCategories} />
                <Route name="about" path="about/" component={About} />
                <Route name="login" path="login/" component={Login} />
                <Route name="notfound" path="404.html" component={PageNotFound} />
                <Route name="admin" path="admin/" component={AdminPage} >
                    <Route name="admin-category" path="cate/" component={CategoriesConsole}></Route>
                </Route>

                {/* twitter */}
                <Route name="twitter" path="twitter/" component={TwitterPage} >
                    <Route name="twitter-status" path="status/:status_id/" component={Tweet} />
                </Route>
            </Route>
            <Redirect from="*" to="/404.html" />
        </Router>
    </Provider>,
    document.getElementById('body')
);
