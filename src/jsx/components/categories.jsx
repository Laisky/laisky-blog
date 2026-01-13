'use strict';

import { gql } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Folder, Layers, List } from 'lucide-react';
import { graphqlQuery } from '../library/base';

export const Categories = () => {
  const [categoriesEle, setcategoriesEle] = useState([]);
  useEffect(() => {
    (async () => {
      const categoriesData = await loader();

      let html = (
        <ul>
          <li key="all">
            <Link to="/categories/all/">
              <Layers size={14} className="me-2" />
              All
            </Link>
          </li>
          {categoriesData &&
            categoriesData.map((cate) => (
              <li key={cate.url}>
                <Link to={`/categories/${cate.url}/`}>
                  <Folder size={14} className="me-2" />
                  {cate.name}
                </Link>
              </li>
            ))}
        </ul>
      );

      setcategoriesEle(html);
    })();
  }, []);

  const loader = async () => {
    const gqBody = gql`
      query {
        BlogPostCategories {
          name
          url
        }
      }
    `;

    const resp = await graphqlQuery(gqBody);
    return resp.BlogPostCategories;
  };

  return (
    <section className="row console categories">
      <h2 className="d-flex align-items-center">
        <List size={14} className="me-2" />
        Categories
      </h2>
      <div>{categoriesEle}</div>
    </section>
  );
};
