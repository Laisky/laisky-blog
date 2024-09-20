'use strict';

import React, { useState, useEffect } from 'react';
import { Link, useParams, useLoaderData } from 'react-router-dom';
import { gql, request } from 'graphql-request'
import { GraphqlAPI } from '../library/base';

export const Tags = () => {
    const [tags, setTags] = useState([]);

    useEffect(() => {
        (async () => {
            const tagsData = await loader();
            setTags(tagsData);
        })();
    }, []);

    const getTagClickHandler = (tag) => () => {
        if (!google || !google.search.cse.element.getElement('post_search')) return;

        google.search.cse.element.getElement('post_search').execute(tag);
    };

    const loader = async () => {
        const gqBody = gql`
            query {
                BlogTags
            }
        `;

        const resp = await request(GraphqlAPI, gqBody);
        return resp.BlogTags;
    }

    return (
        <section className="row console tags">
            <h2>Tags</h2>
            <div className="tag-labels">
                {Array.isArray(tags) && tags.map(tag => (
                    <span key={tag} onClick={getTagClickHandler(tag)} className="badge text-bg-info">
                        {tag}
                    </span>
                ))}
            </div>
        </section>
    );
}
