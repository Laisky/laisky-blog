import * as React from "react";
import * as ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
  Navigate,
} from "react-router-dom";

import "./scss/main.scss";
import { App } from "./jsx/pages/app";


const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<App />}>
      {/* <Route index element={<Navigate to="/pages/1/" />} />
      <Route path="pages/:page" element={<Page />} />
      <Route path="publish" element={<Publish />} />
      <Route path="amend/:postname" element={<Amend />} />
      <Route path="p/:pid" element={<Post />} />
      <Route path="cate/:cateURL?" element={<PostCategories />} />
      <Route path="about" element={<About />} />
      <Route path="login" element={<Login />} />
      <Route path="404.html" element={<PageNotFound />} />
      <Route path="admin" element={<AdminPage />}>
        <Route path="cate" element={<CategoriesConsole />} />
      </Route>
      <Route path="twitter" element={<TwitterPage />}>
        <Route path="status/:status_id" element={<Tweet />} />
      </Route> */}
    </Route>
  )
);


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
