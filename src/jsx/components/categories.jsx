'use strict';

import { gql, request } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGraphqlAPI } from '../library/base';


export const Categories = () => {
    const [categoriesEle, setcategoriesEle] = useState([]);
    useEffect(() => {
        (async () => {
            const categoriesData = await loader();

            let html = (
                <ul>
                    <li key="all">
                        <Link to="/categories/all/">All</Link>
                    </li>
                    {categoriesData && categoriesData.map(cate => (
                        <li key={cate.url}>
                            <Link to={`/categories/${cate.url}/`}>{cate.name}</Link>
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

        const resp = await request(getGraphqlAPI(), gqBody);
        return resp.BlogPostCategories;
    }

    return (
        <section className="row console categories">
            <h2>Categories</h2>
            <div>{categoriesEle}</div>
        </section>
    );
}
