import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';

import '../scss/main.scss';

import { consumeSSOCallbackToken } from './library/sso';
import { About } from './pages/about';
import { App } from './pages/app';
import { Categories, loader as categoriesLoader } from './pages/categories';
import { PostEdit } from './pages/edit';
import { Manage } from './pages/manage';
import NotFound from './pages/notfound';
import { Page, loader as pageLoader } from './pages/pages';
import { Post } from './pages/post';

await consumeSSOCallbackToken();

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/pages/0/" />,
      },
      {
        path: 'pages/:nPage/',
        element: <Page />,
        loader: pageLoader,
      },
      {
        path: 'p/:name/',
        element: <Post isHistory="false" />,
      },
      {
        path: 'p/history/:name/',
        element: <Post isHistory="true" />,
      },
      {
        path: 'edit/:name/',
        element: <PostEdit isPublish="false" />,
      },
      {
        path: 'publish/',
        element: <PostEdit isPublish="true" />,
      },
      {
        path: 'admin/',
        element: <Manage />,
      },
      {
        path: 'about/:tab/',
        element: <About />,
      },
      {
        path: 'about/',
        element: <Navigate to="/about/site/" replace />,
      },
      {
        path: 'categories/:category',
        element: <Categories />,
        loader: categoriesLoader,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
