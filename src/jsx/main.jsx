import * as React from "react";
import * as ReactDOM from "react-dom/client";
import {
    createBrowserRouter,
    Navigate,
    RouterProvider,
} from "react-router-dom";

import "../scss/main.scss";

import { About } from "./pages/about";
import { App } from "./pages/app";
import { PostEdit, loader as postEditLoader } from "./pages/edit";
import { Login } from "./pages/login";
import { Page, loader as pageLoader } from "./pages/pages";
import { Post, loader as postLoader } from "./pages/post";
import { Categories, loader as categoriesLoader } from "./pages/categories";


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
            {
                path: "categories/:category",
                element: <Categories />,
                loader: categoriesLoader,
            },
        ],
    },
]);


ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
