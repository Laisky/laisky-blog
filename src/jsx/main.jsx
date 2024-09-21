import * as React from "react";
import * as ReactDOM from "react-dom/client";
import {
    createBrowserRouter,
    RouterProvider,
    Navigate,
} from "react-router-dom";

import "../scss/main.scss";

import { App } from "./pages/app";
import { Page, loader as pageLoader } from "./pages/pages";
import { Post, loader as postLoader } from "./pages/post";
import { About } from "./pages/about";
import { PostEdit, loader as postEditLoader } from "./pages/edit";
import { Login } from "./pages/login";


const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: [
            {
                index: true,
                element: <Navigate to="/pages/0/" />,
            },
            {
                path: "pages/:nPage/",
                element: <Page />,
                loader: pageLoader,
            },
            {
                path: "p/:name/",
                element: <Post />,
                loader: postLoader,
            },
            {
                path: "edit/:name/",
                element: <PostEdit />,
                loader: postEditLoader,
            },
            {
                path: "about/",
                element: <About />,
            },
            {
                path: "login/",
                element: <Login />,
            },
            // Uncomment and add loaders/actions if needed
            // {
            //   path: "publish",
            //   element: <Publish />,
            // },
            // {
            //   path: "amend/:postname",
            //   element: <Amend />,
            // },
            // {
            //   path: "p/:pid",
            //   element: <Post />,
            // },
            // {
            //   path: "cate/:cateURL?",
            //   element: <PostCategories />,
            // },
            // {
            //   path: "about",
            //   element: <About />,
            // },
            // {
            //   path: "login",
            //   element: <Login />,
            // },
            // {
            //   path: "404.html",
            //   element: <PageNotFound />,
            // },
            // {
            //   path: "admin",
            //   element: <AdminPage />,
            //   children: [
            //     {
            //       path: "cate",
            //       element: <CategoriesConsole />,
            //     },
            //   ],
            // },
            // {
            //   path: "twitter",
            //   element: <TwitterPage />,
            //   children: [
            //     {
            //       path: "status/:status_id",
            //       element: <Tweet />,
            //     },
            //   ],
            // },
        ],
    },
]);


ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
